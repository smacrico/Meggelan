############### create RunningAnalysis database in Production environment
# version 7.3 - fixed recovery_heart_rate source table and stale rows
# Uses parsed FIT values from Run_Artemistbl_Fields where Garmin recovery HR field 202 is stored.

import sqlite3
from datetime import datetime

CURRENT_YEAR = datetime.now().year
DB_APEX = r'c:/smakrykoDBs/Apex.db'
DB_ARTEMIS = r'c:/smakrykoDBs/artemis.db'
DB_GARMIN = r'c:/smakrykoDBs/garmin_activities.db'
#SOURCE_TABLE = 'Run_Artemistbl_Fields'
SOURCE_TABLE = 'adv_Artemistbl_Fields'

def column_exists(cursor, table_name, column_name):
    cursor.execute(f"PRAGMA table_info({table_name})")
    return column_name.lower() in {row[1].lower() for row in cursor.fetchall()}


def create_table_if_not_exists():
    conn = sqlite3.connect(DB_APEX)
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS adv_running_sessions (
            activity_id TEXT PRIMARY KEY,
            running_economy INT,
            date TEXT,
            distance REAL,
            sport TEXT,
            vo2max INT,
            cardiacdrift REAL,
            heart_rate INT,
            time REAL,
            calories INT,
            avg_speed REAL,
            max_speed REAL,
            HR_RS_Deviation_Index REAL,

            total_cycles REAL,
            total_distance REAL,
            total_calories INT,
            avg_heart_rate INT,
            max_heart_rate INT,
            average_cadence REAL,
            max_cadence REAL,
            total_ascent REAL,
            total_descent REAL,
            estimated_sweat_loss_ml REAL,
            recovery_heart_rate INT
        )
    """)

    required_columns = {
        "activity_id": "TEXT",
        "calories": "INT",
        "total_cycles": "REAL",
        "total_distance": "REAL",
        "total_calories": "INT",
        "avg_heart_rate": "INT",
        "max_heart_rate": "INT",
        "average_cadence": "REAL",
        "max_cadence": "REAL",
        "total_ascent": "REAL",
        "total_descent": "REAL",
        "estimated_sweat_loss_ml": "REAL",
        "recovery_heart_rate": "INT",
    }

    cursor.execute("PRAGMA table_info(adv_running_sessions)")
    existing_columns = {row[1] for row in cursor.fetchall()}

    for column_name, column_type in required_columns.items():
        if column_name not in existing_columns:
            cursor.execute(f"ALTER TABLE adv_running_sessions ADD COLUMN {column_name} {column_type}")

    conn.commit()
    conn.close()


create_table_if_not_exists()

conn_artemis = None
conn_garmin = None
conn_running_analysis = None

try:
    conn_artemis = sqlite3.connect(DB_ARTEMIS)
    conn_garmin = sqlite3.connect(DB_GARMIN)
    conn_running_analysis = sqlite3.connect(DB_APEX)

    cursor_artemis = conn_artemis.cursor()
    cursor_running_analysis = conn_running_analysis.cursor()

    cursor_artemis.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (SOURCE_TABLE,)
    )
    if cursor_artemis.fetchone() is None:
        raise sqlite3.Error(
            f"Source table {SOURCE_TABLE} not found. Run the jHeel FIT parser first."
        )

    if not column_exists(cursor_artemis, SOURCE_TABLE, "recovery_heart_rate"):
        raise sqlite3.Error(
            f"{SOURCE_TABLE}.recovery_heart_rate not found. Run plugin v7.4 or later first."
        )

    print(f"[INFO] Loading activities from year {CURRENT_YEAR} only...")
    print(f"[INFO] Source table: {SOURCE_TABLE}")

    cursor_running_analysis.execute(
        "DELETE FROM adv_running_sessions WHERE strftime('%Y', date) = ?",
        (str(CURRENT_YEAR),)
    )

    cursor_artemis.execute(f"""
        SELECT
            CAST(a.activity_id AS TEXT),
            a.Running_Economy,
            a.timestamp,
            a.distance,
            a.sport,
            a.VO2maxSession,
            a.CardiacDrift,
            a.avg_heart_rate,
            a.total_elapsed_time,
            COALESCE(a.total_calories, a.calories),
            g.avg_speed,
            g.max_speed,
            a.HR_RS_Deviation_Index,

            a.total_cycles,
            a.total_distance,
            COALESCE(a.total_calories, a.calories),
            a.avg_heart_rate,
            a.max_heart_rate,
            a.avg_cadence,
            a.max_cadence,
            a.total_ascent,
            a.total_descent,
            a.estimated_sweat_loss_ml,
            a.recovery_heart_rate
        FROM {SOURCE_TABLE} a
        INNER JOIN activities g ON CAST(a.activity_id AS TEXT) = CAST(g.activity_id AS TEXT)
        WHERE lower(a.sport) LIKE '%running%'
          AND strftime('%Y', a.timestamp) = ?
    """, (str(CURRENT_YEAR),))

    rows = cursor_artemis.fetchall()
    row_count = len(rows)

    if row_count > 0:
        cursor_running_analysis.executemany("""
            INSERT OR REPLACE INTO adv_running_sessions (
                activity_id,
                running_economy,
                date,
                distance,
                sport,
                vo2max,
                cardiacdrift,
                heart_rate,
                time,
                calories,
                avg_speed,
                max_speed,
                HR_RS_Deviation_Index,

                total_cycles,
                total_distance,
                total_calories,
                avg_heart_rate,
                max_heart_rate,
                average_cadence,
                max_cadence,
                total_ascent,
                total_descent,
                estimated_sweat_loss_ml,
                recovery_heart_rate
            )
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, rows)

        conn_running_analysis.commit()
        print(f"[SUCCESS] Imported {row_count} running sessions from {CURRENT_YEAR}")
    else:
        print(f"[WARNING] No running activities found for year {CURRENT_YEAR}")

except sqlite3.Error as e:
    print(f"An error occurred: {e}")
    if conn_running_analysis:
        conn_running_analysis.rollback()

finally:
    if conn_artemis:
        conn_artemis.close()
    if conn_garmin:
        conn_garmin.close()
    if conn_running_analysis:
        conn_running_analysis.close()

print(f"[INFO] Data transfer completed for year {CURRENT_YEAR}!")
print(f"[INFO] Database path: {DB_APEX}")
