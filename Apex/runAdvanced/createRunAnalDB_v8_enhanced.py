############### create RunningAnalysis database in Production environment
# version 8.0 - enhanced schema for metrics_enhanced.py
# Creates/updates raw running sessions and enhanced calculated-output tables.
# Keeps legacy column names for compatibility and adds normalized metric column names.

import sqlite3
from datetime import datetime
from typing import Dict

CURRENT_YEAR = datetime.now().year

DB_APEX = r"c:/smakrykoDBs/Apex.db"
DB_ARTEMIS = r"c:/smakrykoDBs/artemis.db"
DB_GARMIN = r"c:/smakrykoDBs/garmin_activities.db"

SOURCE_TABLE = "adv_Artemistbl_Fields"
RUNNING_SESSIONS_TABLE = "adv_running_sessions"
TRAINING_LOG_TABLE = "adv_training_log"
MONTHLY_SUMMARIES_TABLE = "adv_monthly_summaries"
METRICS_BREAKDOWN_TABLE = "adv_metrics_breakdown"


def column_exists(cursor: sqlite3.Cursor, table_name: str, column_name: str) -> bool:
    cursor.execute(f"PRAGMA table_info({table_name})")
    return column_name.lower() in {row[1].lower() for row in cursor.fetchall()}


def add_missing_columns(cursor: sqlite3.Cursor, table_name: str, columns: Dict[str, str]) -> None:
    cursor.execute(f"PRAGMA table_info({table_name})")
    existing_columns = {row[1].lower() for row in cursor.fetchall()}

    for column_name, column_type in columns.items():
        if column_name.lower() not in existing_columns:
            cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")


def create_or_update_running_sessions_table(cursor: sqlite3.Cursor) -> None:
    cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {RUNNING_SESSIONS_TABLE} (
            activity_id TEXT PRIMARY KEY,

            -- Normalized raw columns consumed by metrics_enhanced.py
            date TEXT,
            time REAL,
            distance REAL,
            sport TEXT,
            avg_speed REAL,
            max_speed REAL,
            heart_rate REAL,
            vo2max REAL,
            running_economy REAL,
            cardiac_drift REAL,
            hr_rs_deviation REAL,

            -- Optional recovery/readiness inputs
            resting_hr REAL,
            sleep_quality REAL,
            fatigue_level REAL,

            -- Optional true aerobic decoupling inputs
            first_half_hr REAL,
            second_half_hr REAL,
            first_half_speed REAL,
            second_half_speed REAL,

            -- Garmin / FIT supporting raw fields
            calories INTEGER,
            total_cycles REAL,
            total_distance REAL,
            total_calories INTEGER,
            avg_heart_rate INTEGER,
            max_heart_rate INTEGER,
            average_cadence REAL,
            max_cadence REAL,
            total_ascent REAL,
            total_descent REAL,
            estimated_sweat_loss_ml REAL,
            recovery_heart_rate INTEGER,

            -- Legacy compatibility columns from previous versions
            cardiacdrift REAL,
            HR_RS_Deviation_Index REAL
        )
    """)

    add_missing_columns(cursor, RUNNING_SESSIONS_TABLE, {
        "date": "TEXT",
        "time": "REAL",
        "distance": "REAL",
        "sport": "TEXT",
        "avg_speed": "REAL",
        "max_speed": "REAL",
        "heart_rate": "REAL",
        "vo2max": "REAL",
        "running_economy": "REAL",
        "cardiac_drift": "REAL",
        "hr_rs_deviation": "REAL",
        "resting_hr": "REAL",
        "sleep_quality": "REAL",
        "fatigue_level": "REAL",
        "first_half_hr": "REAL",
        "second_half_hr": "REAL",
        "first_half_speed": "REAL",
        "second_half_speed": "REAL",
        "calories": "INTEGER",
        "total_cycles": "REAL",
        "total_distance": "REAL",
        "total_calories": "INTEGER",
        "avg_heart_rate": "INTEGER",
        "max_heart_rate": "INTEGER",
        "average_cadence": "REAL",
        "max_cadence": "REAL",
        "total_ascent": "REAL",
        "total_descent": "REAL",
        "estimated_sweat_loss_ml": "REAL",
        "recovery_heart_rate": "INTEGER",
        "cardiacdrift": "REAL",
        "HR_RS_Deviation_Index": "REAL",
    })


def create_training_log_table(cursor: sqlite3.Cursor) -> None:
    cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {TRAINING_LOG_TABLE} (
            activity_id TEXT PRIMARY KEY,
            date TEXT,
            time REAL,
            distance REAL,
            sport TEXT,
            avg_speed REAL,
            max_speed REAL,
            heart_rate REAL,
            vo2max REAL,
            running_economy REAL,
            cardiac_drift REAL,
            hr_rs_deviation REAL,

            resting_hr REAL,
            sleep_quality REAL,
            fatigue_level REAL,
            first_half_hr REAL,
            second_half_hr REAL,
            first_half_speed REAL,
            second_half_speed REAL,

            duration_min REAL,
            duration_hr REAL,
            efficiency_score REAL,
            energy_cost REAL,
            speed_reserve REAL,
            speed_consistency REAL,
            pace_per_km REAL,
            speed_efficiency REAL,
            economy_at_speed REAL,
            speed_vo2max_index REAL,

            efficiency_factor REAL,
            performance_index REAL,
            aerobic_decoupling_pct REAL,

            hr_ratio REAL,
            TRIMP REAL,
            acute_load_7d REAL,
            chronic_load_28d REAL,
            acwr_7_28 REAL,
            weekly_monotony REAL,
            weekly_strain REAL,

            physio_efficiency REAL,
            fatigue_index REAL,
            speed_zone TEXT,

            iso_year INTEGER,
            iso_week INTEGER,
            week_label TEXT,

            trimp_rolling_7 REAL,
            speed_rolling_7 REAL,
            hr_rs_rolling_7 REAL,

            rhr_score REAL,
            load_score REAL,
            sleep_score REAL,
            fatigue_score REAL,
            recovery_score REAL,
            readiness_score REAL,

            hr_rs_z REAL,
            acwr REAL,
            fatigue_flag INTEGER,
            overtraining_flag INTEGER,
            risk_level TEXT
        )
    """)

    add_missing_columns(cursor, TRAINING_LOG_TABLE, {
        "activity_id": "TEXT",
        "date": "TEXT",
        "time": "REAL",
        "distance": "REAL",
        "sport": "TEXT",
        "avg_speed": "REAL",
        "max_speed": "REAL",
        "heart_rate": "REAL",
        "vo2max": "REAL",
        "running_economy": "REAL",
        "cardiac_drift": "REAL",
        "hr_rs_deviation": "REAL",
        "resting_hr": "REAL",
        "sleep_quality": "REAL",
        "fatigue_level": "REAL",
        "first_half_hr": "REAL",
        "second_half_hr": "REAL",
        "first_half_speed": "REAL",
        "second_half_speed": "REAL",
        "duration_min": "REAL",
        "duration_hr": "REAL",
        "efficiency_score": "REAL",
        "energy_cost": "REAL",
        "speed_reserve": "REAL",
        "speed_consistency": "REAL",
        "pace_per_km": "REAL",
        "speed_efficiency": "REAL",
        "economy_at_speed": "REAL",
        "speed_vo2max_index": "REAL",
        "efficiency_factor": "REAL",
        "performance_index": "REAL",
        "aerobic_decoupling_pct": "REAL",
        "hr_ratio": "REAL",
        "TRIMP": "REAL",
        "acute_load_7d": "REAL",
        "chronic_load_28d": "REAL",
        "acwr_7_28": "REAL",
        "weekly_monotony": "REAL",
        "weekly_strain": "REAL",
        "physio_efficiency": "REAL",
        "fatigue_index": "REAL",
        "speed_zone": "TEXT",
        "iso_year": "INTEGER",
        "iso_week": "INTEGER",
        "week_label": "TEXT",
        "trimp_rolling_7": "REAL",
        "speed_rolling_7": "REAL",
        "hr_rs_rolling_7": "REAL",
        "rhr_score": "REAL",
        "load_score": "REAL",
        "sleep_score": "REAL",
        "fatigue_score": "REAL",
        "recovery_score": "REAL",
        "readiness_score": "REAL",
        "hr_rs_z": "REAL",
        "acwr": "REAL",
        "fatigue_flag": "INTEGER",
        "overtraining_flag": "INTEGER",
        "risk_level": "TEXT",
    })


def create_monthly_summaries_table(cursor: sqlite3.Cursor) -> None:
    metric_names = [
        "running_economy", "vo2max", "distance", "efficiency_score", "heart_rate",
        "energy_cost", "TRIMP", "acute_load_7d", "chronic_load_28d", "acwr_7_28",
        "weekly_monotony", "weekly_strain", "recovery_score", "readiness_score",
        "avg_speed", "max_speed", "speed_reserve", "hr_rs_deviation",
        "speed_efficiency", "efficiency_factor", "performance_index",
        "aerobic_decoupling_pct", "pace_per_km", "economy_at_speed",
        "physio_efficiency", "fatigue_index",
    ]

    metric_columns_sql = ",\n            ".join(
        f"{metric}_mean REAL, {metric}_std REAL, {metric}_count INTEGER"
        for metric in metric_names
    )

    cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {MONTHLY_SUMMARIES_TABLE} (
            year_month TEXT PRIMARY KEY,
            session_count INTEGER,
            {metric_columns_sql}
        )
    """)

    required = {"session_count": "INTEGER"}
    for metric in metric_names:
        required[f"{metric}_mean"] = "REAL"
        required[f"{metric}_std"] = "REAL"
        required[f"{metric}_count"] = "INTEGER"
    add_missing_columns(cursor, MONTHLY_SUMMARIES_TABLE, required)


def create_metrics_breakdown_table(cursor: sqlite3.Cursor) -> None:
    cursor.execute(f"""
        CREATE TABLE IF NOT EXISTS {METRICS_BREAKDOWN_TABLE} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            calculation_date TEXT,
            overall_score REAL,

            running_economy_normalized REAL,
            running_economy_weighted REAL,
            running_economy_raw_mean REAL,
            running_economy_raw_std REAL,

            vo2max_normalized REAL,
            vo2max_weighted REAL,
            vo2max_raw_mean REAL,
            vo2max_raw_std REAL,

            distance_normalized REAL,
            distance_weighted REAL,
            distance_raw_mean REAL,
            distance_raw_std REAL,

            efficiency_score_normalized REAL,
            efficiency_score_weighted REAL,
            efficiency_score_raw_mean REAL,
            efficiency_score_raw_std REAL,

            heart_rate_normalized REAL,
            heart_rate_weighted REAL,
            heart_rate_raw_mean REAL,
            heart_rate_raw_std REAL,

            running_economy_trend REAL,
            distance_progression REAL,

            avg_speed_mean REAL,
            avg_speed_std REAL,
            max_speed_mean REAL,
            max_speed_std REAL,
            speed_reserve_mean REAL,
            speed_reserve_std REAL,
            speed_consistency_mean REAL,
            speed_consistency_std REAL,
            pace_per_km_mean REAL,
            pace_per_km_std REAL,
            speed_efficiency_mean REAL,
            speed_efficiency_std REAL,
            economy_at_speed_mean REAL,
            economy_at_speed_std REAL,
            speed_vo2max_index_mean REAL,
            speed_vo2max_index_std REAL,

            hr_rs_deviation_mean REAL,
            hr_rs_deviation_std REAL,
            cardiac_drift_mean REAL,
            cardiac_drift_std REAL,
            physio_efficiency_mean REAL,
            physio_efficiency_std REAL,
            fatigue_index_mean REAL,
            fatigue_index_std REAL,

            efficiency_factor_mean REAL,
            efficiency_factor_std REAL,
            performance_index_mean REAL,
            performance_index_std REAL,
            aerobic_decoupling_pct_mean REAL,
            aerobic_decoupling_pct_std REAL,
            acwr_7_28_mean REAL,
            acwr_7_28_std REAL,
            weekly_monotony_mean REAL,
            weekly_monotony_std REAL,
            weekly_strain_mean REAL,
            weekly_strain_std REAL
        )
    """)

    add_missing_columns(cursor, METRICS_BREAKDOWN_TABLE, {
        "calculation_date": "TEXT",
        "overall_score": "REAL",
        "running_economy_normalized": "REAL",
        "running_economy_weighted": "REAL",
        "running_economy_raw_mean": "REAL",
        "running_economy_raw_std": "REAL",
        "vo2max_normalized": "REAL",
        "vo2max_weighted": "REAL",
        "vo2max_raw_mean": "REAL",
        "vo2max_raw_std": "REAL",
        "distance_normalized": "REAL",
        "distance_weighted": "REAL",
        "distance_raw_mean": "REAL",
        "distance_raw_std": "REAL",
        "efficiency_score_normalized": "REAL",
        "efficiency_score_weighted": "REAL",
        "efficiency_score_raw_mean": "REAL",
        "efficiency_score_raw_std": "REAL",
        "heart_rate_normalized": "REAL",
        "heart_rate_weighted": "REAL",
        "heart_rate_raw_mean": "REAL",
        "heart_rate_raw_std": "REAL",
        "running_economy_trend": "REAL",
        "distance_progression": "REAL",
        "avg_speed_mean": "REAL",
        "avg_speed_std": "REAL",
        "max_speed_mean": "REAL",
        "max_speed_std": "REAL",
        "speed_reserve_mean": "REAL",
        "speed_reserve_std": "REAL",
        "speed_consistency_mean": "REAL",
        "speed_consistency_std": "REAL",
        "pace_per_km_mean": "REAL",
        "pace_per_km_std": "REAL",
        "speed_efficiency_mean": "REAL",
        "speed_efficiency_std": "REAL",
        "economy_at_speed_mean": "REAL",
        "economy_at_speed_std": "REAL",
        "speed_vo2max_index_mean": "REAL",
        "speed_vo2max_index_std": "REAL",
        "hr_rs_deviation_mean": "REAL",
        "hr_rs_deviation_std": "REAL",
        "cardiac_drift_mean": "REAL",
        "cardiac_drift_std": "REAL",
        "physio_efficiency_mean": "REAL",
        "physio_efficiency_std": "REAL",
        "fatigue_index_mean": "REAL",
        "fatigue_index_std": "REAL",
        "efficiency_factor_mean": "REAL",
        "efficiency_factor_std": "REAL",
        "performance_index_mean": "REAL",
        "performance_index_std": "REAL",
        "aerobic_decoupling_pct_mean": "REAL",
        "aerobic_decoupling_pct_std": "REAL",
        "acwr_7_28_mean": "REAL",
        "acwr_7_28_std": "REAL",
        "weekly_monotony_mean": "REAL",
        "weekly_monotony_std": "REAL",
        "weekly_strain_mean": "REAL",
        "weekly_strain_std": "REAL",
    })


def create_all_tables() -> None:
    conn = sqlite3.connect(DB_APEX)
    try:
        cursor = conn.cursor()
        create_or_update_running_sessions_table(cursor)
        create_training_log_table(cursor)
        create_monthly_summaries_table(cursor)
        create_metrics_breakdown_table(cursor)
        conn.commit()
    finally:
        conn.close()


def validate_source_schema(cursor: sqlite3.Cursor) -> None:
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (SOURCE_TABLE,),
    )
    if cursor.fetchone() is None:
        raise sqlite3.Error(f"Source table {SOURCE_TABLE} not found. Run the FIT parser first.")

    required_source_columns = [
        "activity_id",
        "Running_Economy",
        "timestamp",
        "distance",
        "sport",
        "VO2maxSession",
        "CardiacDrift",
        "avg_heart_rate",
        "total_elapsed_time",
        "HR_RS_Deviation_Index",
        "total_cycles",
        "total_distance",
        "avg_cadence",
        "max_cadence",
        "total_ascent",
        "total_descent",
        "estimated_sweat_loss_ml",
        "recovery_heart_rate",
    ]

    missing = [col for col in required_source_columns if not column_exists(cursor, SOURCE_TABLE, col)]
    if missing:
        raise sqlite3.Error(
            f"{SOURCE_TABLE} is missing required columns: {', '.join(missing)}"
        )


def import_current_year_sessions() -> None:
    conn_artemis = None
    conn_garmin = None
    conn_running_analysis = None

    try:
        conn_artemis = sqlite3.connect(DB_ARTEMIS)
        conn_garmin = sqlite3.connect(DB_GARMIN)
        conn_running_analysis = sqlite3.connect(DB_APEX)

        cursor_artemis = conn_artemis.cursor()
        cursor_running_analysis = conn_running_analysis.cursor()

        validate_source_schema(cursor_artemis)

        print(f"[INFO] Loading activities from year {CURRENT_YEAR} only...")
        print(f"[INFO] Source table: {SOURCE_TABLE}")

        cursor_running_analysis.execute(
            f"DELETE FROM {RUNNING_SESSIONS_TABLE} WHERE strftime('%Y', date) = ?",
            (str(CURRENT_YEAR),),
        )

        cursor_artemis.execute(f"""
            SELECT
                CAST(a.activity_id AS TEXT) AS activity_id,

                -- normalized columns
                a.timestamp AS date,
                a.total_elapsed_time AS time,
                a.distance AS distance,
                a.sport AS sport,
                g.avg_speed AS avg_speed,
                g.max_speed AS max_speed,
                a.avg_heart_rate AS heart_rate,
                a.VO2maxSession AS vo2max,
                a.Running_Economy AS running_economy,
                a.CardiacDrift AS cardiac_drift,
                a.HR_RS_Deviation_Index AS hr_rs_deviation,

                -- optional user-entered readiness/decoupling fields unavailable in FIT source
                NULL AS resting_hr,
                NULL AS sleep_quality,
                NULL AS fatigue_level,
                NULL AS first_half_hr,
                NULL AS second_half_hr,
                NULL AS first_half_speed,
                NULL AS second_half_speed,

                -- supporting raw fields
                COALESCE(a.total_calories, a.calories) AS calories,
                a.total_cycles,
                a.total_distance,
                COALESCE(a.total_calories, a.calories) AS total_calories,
                a.avg_heart_rate AS avg_heart_rate,
                a.max_heart_rate AS max_heart_rate,
                a.avg_cadence AS average_cadence,
                a.max_cadence AS max_cadence,
                a.total_ascent,
                a.total_descent,
                a.estimated_sweat_loss_ml,
                a.recovery_heart_rate,

                -- legacy compatibility duplicate values
                a.CardiacDrift AS cardiacdrift,
                a.HR_RS_Deviation_Index AS HR_RS_Deviation_Index

            FROM {SOURCE_TABLE} a
            INNER JOIN activities g
                ON CAST(a.activity_id AS TEXT) = CAST(g.activity_id AS TEXT)
            WHERE lower(a.sport) LIKE '%running%'
              AND strftime('%Y', a.timestamp) = ?
        """, (str(CURRENT_YEAR),))

        rows = cursor_artemis.fetchall()
        row_count = len(rows)

        if row_count > 0:
            cursor_running_analysis.executemany(f"""
                INSERT OR REPLACE INTO {RUNNING_SESSIONS_TABLE} (
                    activity_id,
                    date,
                    time,
                    distance,
                    sport,
                    avg_speed,
                    max_speed,
                    heart_rate,
                    vo2max,
                    running_economy,
                    cardiac_drift,
                    hr_rs_deviation,
                    resting_hr,
                    sleep_quality,
                    fatigue_level,
                    first_half_hr,
                    second_half_hr,
                    first_half_speed,
                    second_half_speed,
                    calories,
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
                    recovery_heart_rate,
                    cardiacdrift,
                    HR_RS_Deviation_Index
                )
                VALUES ({",".join(["?"] * 33)})
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


if __name__ == "__main__":
    create_all_tables()
    import_current_year_sessions()
    print(f"[INFO] Data transfer completed for year {CURRENT_YEAR}!")
    print(f"[INFO] Database path: {DB_APEX}")
