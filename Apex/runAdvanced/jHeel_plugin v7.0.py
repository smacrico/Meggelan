
import sqlite3
import os
import logging
import datetime


# Set up logging
now = datetime.datetime.now()
timestamp = now.strftime('%Y%m%d_%H%M%S')
logging.basicConfig(filename=f'c:/temp/logsFitnessApp/jheel_parse_Fields-v5{timestamp}.log', level=logging.INFO)
logging.info('Starting script...')
print('Starting script...')


def create_table_if_not_exists():
    conn = sqlite3.connect(r'c:/smakrykoDBs/artemis.db')
    cursor = conn.cursor()

    cursor.execute('DROP TABLE IF EXISTS adv_Artemistbl_Fields')
    logging.info('Table dropped successfully.')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS adv_Artemistbl_Fields (
            activity_id INT PRIMARY KEY,
            name TEXT,
            timestamp TEXT,
            sport TEXT,
            avg_heart_rate INT,
            max_heart_rate INT,
            total_elapsed_time INT,
            distance REAL,
            hrv INT,
            fat INT,
            total_fat INT,  
            carbs INT,
            total_carbs INT,
            VO2maxSmooth INT,
            VO2maxSession INT,
            CardiacDrift INT,    
            CooperTest INT,
            steps INT,
            stress_hrpa INT,
            HR_RS_Deviation_Index INT,
            hrv_sdrr_f INT,
            hrv_pnn50 INT,                           
            hrv_pnn20 INT,
            rmssd INT,
            aarmssd INT,
            lnrmssd INT,
            sdnn INT,
            aasdnn INT,
            sdsd INT,
            nn50 INT,
            nn20 INT,
            pnn20 INT,
            Long INT,
            Short INT,
            Ectopic_S INT,
            hrv_rmssd INT,
            SD2 INT,
            SD1 INT,
            LF INT,
            HF INT,
            VLF INT,
            pNN50 INT, 
            LFnu INT, 
            HFnu INT,
            MeanHR INT, 
            MeanRR INT, 
            Running_Economy TEXT, 
            aHRV INT, 
            arMSSD INT, 
            aSDNN INT, 
            calories INT,
            total_calories INT,
            total_training_effect REAL,
            recovery_heart_rate INT,
            aerobic_efficiency REAL,
            estimated_sweat_loss_ml REAL,
            avg_cadence INT,
            max_cadence INT,
            total_strides INT,
            total_cycles INT,
            total_distance REAL,
            total_ascent INT,
            total_descent INT
        )
    ''')
    logging.info('Table adv_Artemistbl_Fields created successfully.')
    conn.commit()
    conn.close()


from fitparse import FitFile


def parse_all_fit_files_in_folder(folder_path):
    all_session_data = []
    for filename in os.listdir(folder_path):
        if filename.endswith('.fit'):
            try:
                fit_file_path = os.path.join(folder_path, filename)
                activity_id = os.path.splitext(filename)[0]
                activity_id = activity_id.split('_')[0]
                session_data = parse_fit_file(fit_file_path, activity_id)
                all_session_data.extend(session_data)
            except Exception as e:
                logging.error(f'Error parsing file {filename}: {e}')
                print(f'Error parsing file {filename}: {e}')
                continue
    logging.info('All files parsed successfully.')  
    print('All files parsed successfully.')
    return all_session_data


def parse_fit_file(file_path, activity_id):
    fit_file = FitFile(file_path)

    # Convert to a list so we can read record samples and session data safely.
    messages = list(fit_file.get_messages())
    session_data = []
    name = None
    heart_rate_samples = []

    def get_first(field_dict, *field_names):
        """Return the first non-empty FIT field value from a list of possible field names."""
        for field_name in field_names:
            value = field_dict.get(field_name)
            if value is not None:
                return value
        return None

    def seconds_value(value):
        """FIT elapsed time is usually seconds, but keep this safe for blank/bad values."""
        try:
            return float(value) if value is not None else None
        except (TypeError, ValueError):
            return None

    def calculate_estimated_sweat_loss_ml(total_elapsed_time, avg_heart_rate, max_heart_rate, total_calories, sport):
        """
        Estimate sweat loss in milliliters when body weight and measured fluid loss are unavailable.
        This is intentionally conservative and based on duration plus intensity from heart rate.
        """
        elapsed_seconds = seconds_value(total_elapsed_time)
        if not elapsed_seconds or elapsed_seconds <= 0:
            return None

        sport_text = str(sport or '').lower()
        base_rate_ml_per_hour = 700
        if 'run' in sport_text:
            base_rate_ml_per_hour = 800
        elif 'cycl' in sport_text or 'bike' in sport_text:
            base_rate_ml_per_hour = 600
        elif 'walk' in sport_text:
            base_rate_ml_per_hour = 450

        intensity_multiplier = 1.0
        try:
            avg_hr = float(avg_heart_rate) if avg_heart_rate is not None else None
            max_hr = float(max_heart_rate) if max_heart_rate is not None else None
        except (TypeError, ValueError):
            avg_hr = None
            max_hr = None

        if avg_hr is not None:
            if avg_hr < 120:
                intensity_multiplier = 0.75
            elif avg_hr < 145:
                intensity_multiplier = 1.00
            elif avg_hr < 165:
                intensity_multiplier = 1.25
            else:
                intensity_multiplier = 1.50
        elif max_hr is not None:
            if max_hr >= 180:
                intensity_multiplier = 1.35
            elif max_hr >= 160:
                intensity_multiplier = 1.15

        # Calories can indicate high work even when HR is missing or low.
        calories = None
        try:
            calories = float(total_calories) if total_calories is not None else None
        except (TypeError, ValueError):
            calories = None

        estimated_ml = (elapsed_seconds / 3600.0) * base_rate_ml_per_hour * intensity_multiplier

        if calories and elapsed_seconds > 0:
            calories_per_hour = calories / (elapsed_seconds / 3600.0)
            if calories_per_hour > 800:
                estimated_ml *= 1.15
            elif calories_per_hour < 300:
                estimated_ml *= 0.85

        return round(estimated_ml, 1)

    def to_int(value):
        """Safely convert a FIT field value to int."""
        if value is None:
            return None
        try:
            return int(round(float(value)))
        except (TypeError, ValueError):
            return None

    def find_fit_recovery_heart_rate(messages):
        """
        Return the recovery heart-rate value stored in the FIT session.

        In your FIT files the correct Garmin recovery heart-rate is stored as
        session field number 202. Some FIT parsers do not expose that field with
        a friendly name, so this reads the raw field number first.

        Important: do NOT use the FIT event/data value as priority here. In your
        files that value can be the normal HR value around the recovery event
        (for example 84/88), not the displayed Recovery Heart Rate value (37).
        """
        def fit_field_number(field):
            """Best-effort access to the raw FIT field definition number."""
            for attr in ('def_num', 'num', 'number'):
                value = getattr(field, attr, None)
                if value is not None:
                    return value

            field_def = getattr(field, 'field_def', None)
            if field_def is not None:
                for attr in ('def_num', 'num', 'number'):
                    value = getattr(field_def, attr, None)
                    if value is not None:
                        return value

            # Some parsers expose unknown fields as names like unknown_202.
            name = str(getattr(field, 'name', '') or '')
            digits = ''.join(ch if ch.isdigit() else ' ' for ch in name).split()
            if digits:
                try:
                    return int(digits[-1])
                except ValueError:
                    return None

            return None

        session_aliases = (
            'recovery_heart_rate',
            'recovery_hr',
            'heart_rate_recovery',
            'recovery heart rate',
            'Recovery Heart Rate',
        )

        # 1) Correct source for these Garmin FIT files: raw SESSION field 202.
        for msg in messages:
            if msg.name != 'session':
                continue

            for field in msg.fields:
                if fit_field_number(field) == 202:
                    recovery_value = to_int(field.value)
                    if recovery_value is not None:
                        logging.info(
                            f"Using FIT session field 202 for recovery_heart_rate: {recovery_value}"
                        )
                        return recovery_value

        # 2) Fallback for FIT files where fitparse exposes the same value by name.
        for msg in messages:
            if msg.name not in ('session', 'lap', 'activity'):
                continue

            field_dict = {field.name: field.value for field in msg.fields}
            direct_value = get_first(field_dict, *session_aliases)
            direct_value = to_int(direct_value)
            if direct_value is not None:
                logging.info(
                    f"Using named FIT field for recovery_heart_rate: {direct_value}"
                )
                return direct_value

        return None

    def calculate_heart_rate_recovery(record_samples, session_start, total_elapsed_time):
        """
        Fallback only when the FIT file does not contain recovery HR.

        This returns the HR value closest to 60 seconds after the activity end, not the drop
        from max HR. Garmin's stored recovery_heart_rate is a heart-rate value, so this fallback
        now uses the same meaning.
        """
        if not record_samples:
            return None

        elapsed_seconds = seconds_value(total_elapsed_time)
        if session_start is not None and elapsed_seconds:
            session_end = session_start + datetime.timedelta(seconds=elapsed_seconds)
        else:
            session_end = record_samples[-1][0]

        target_time = session_end + datetime.timedelta(seconds=60)

        recovery_candidates = [(abs((ts - target_time).total_seconds()), hr)
                               for ts, hr in record_samples
                               if session_end <= ts <= target_time + datetime.timedelta(seconds=90)]

        if not recovery_candidates:
            recovery_candidates = [(abs((ts - target_time).total_seconds()), hr)
                                   for ts, hr in record_samples]

        if not recovery_candidates:
            return None

        return min(recovery_candidates, key=lambda item: item[0])[1]

    # First pass: collect sport name and record-level HR samples.
    for msg in messages:
        fields = msg.fields
        field_dict = {field.name: field.value for field in fields}

        if msg.name == 'sport':
            name = field_dict.get('name')

        elif msg.name == 'record':
            record_timestamp = field_dict.get('timestamp')
            record_hr = field_dict.get('heart_rate')
            if record_timestamp is not None and record_hr is not None:
                try:
                    heart_rate_samples.append((record_timestamp, int(record_hr)))
                except (TypeError, ValueError):
                    pass

    heart_rate_samples.sort(key=lambda sample: sample[0])

    for msg in messages:
        if msg.name == 'session':
            fields = msg.fields
            field_dict = {field.name: field.value for field in fields}

            # TEMP DEBUG: log all session field keys
            logging.info(f"SESSION FIELDS {activity_id}: {list(field_dict.keys())}")

            timestamp = field_dict.get('timestamp')
            start_time = get_first(field_dict, 'start_time', 'start_timestamp')
            sport = field_dict.get('sport')
            avg_heart_rate = field_dict.get('avg_heart_rate')
            max_heart_rate = field_dict.get('max_heart_rate')
            total_elapsed_time = field_dict.get('total_elapsed_time')
            total_distance = get_first(field_dict, 'total_distance', 'distance')
            distance = total_distance
            hrv = field_dict.get('HRV')
            fat = field_dict.get('Fat')
            total_fat = field_dict.get('Total Fat')
            carbs = field_dict.get('Carbs')
            total_carbs = field_dict.get('Total Carbs')
            VO2maxSmooth = field_dict.get('VO2maxSmooth')
            VO2maxSession = field_dict.get('VO2maxSession')
            CardiacDrift = field_dict.get('CardiacDrift')
            CooperTest = field_dict.get('CooperTest')
            steps = field_dict.get('Steps') or field_dict.get('steps')
            stress_hrpa = field_dict.get('stress_hrpa')
            HR_RS_Deviation_Index = field_dict.get('HR-RS Deviation Index')
            hrv_sdrr_f = field_dict.get('hrv_sdrr_f')
            hrv_pnn50 = field_dict.get('hrv_pnn50')
            hrv_pnn20 = field_dict.get('hrv_pnn20')
            rmssd = field_dict.get('RMSSD')
            aarmssd = field_dict.get('armssd')
            lnrmssd = field_dict.get('lnRMSSD')
            sdnn = field_dict.get('SDNN')
            aasdnn = field_dict.get('asdnn')
            sdsd = field_dict.get('SDSD')
            nn50 = field_dict.get('NN50')
            nn20 = field_dict.get('NN20')
            pnn20 = field_dict.get('pNN20')
            Long = field_dict.get('Long')
            Short = field_dict.get('Short')
            Ectopic_S = field_dict.get('Ectopic-S')
            hrv_rmssd = field_dict.get('hrv_rmssd')
            SD2 = field_dict.get('SD2')
            SD1 = field_dict.get('SD1')
            LF = field_dict.get('LF')
            HF = field_dict.get('HF')
            VLF = field_dict.get('VLF')
            pNN50 = field_dict.get('pNN50')
            LFnu = field_dict.get('LFnu')
            HFnu = field_dict.get('HFnu')
            MeanHR = field_dict.get('Mean HR')
            MeanRR = field_dict.get('Mean RR')
            Running_Economy = field_dict.get('Running Economy')
            aHRV = field_dict.get('aHRV')
            arMSSD = field_dict.get('arMSSD')
            aSDNN = field_dict.get('aSDNN')
            calories = field_dict.get('calories')

            total_calories = get_first(field_dict, 'total_calories', 'calories')
            total_training_effect = field_dict.get('total_training_effect') or field_dict.get('training_effect')
            # Prefer the recovery HR value stored in the FIT file. Only calculate a fallback
            # from record samples when the FIT value is missing.
            recovery_heart_rate = find_fit_recovery_heart_rate(messages)
            if recovery_heart_rate is None:
                recovery_heart_rate = calculate_heart_rate_recovery(
                    heart_rate_samples, start_time, total_elapsed_time
                )

            aerobic_efficiency = (field_dict.get('aerobic_efficiency') or
                                  field_dict.get('Aerobic_efficiency') or
                                  field_dict.get('Aerobic Efficiency'))

            estimated_sweat_loss_ml = calculate_estimated_sweat_loss_ml(
                total_elapsed_time, avg_heart_rate, max_heart_rate, total_calories, sport
            )

            avg_cadence = get_first(field_dict,
                                    'avg_cadence',
                                    'avg_cycling_cadence',
                                    'avg_running_cadence',
                                    'cadence')
            max_cadence = get_first(field_dict,
                                    'max_cadence',
                                    'max_cycling_cadence',
                                    'max_running_cadence')
            total_cycles = get_first(field_dict, 'total_cycles', 'cycles')
            total_strides = get_first(field_dict, 'total_strides', 'strides', 'total_cycles')
            total_ascent = get_first(field_dict, 'total_ascent', 'ascent')
            total_descent = get_first(field_dict, 'total_descent', 'descent')

            session_data.append({
                'activity_id': activity_id,
                'name': name,
                'timestamp': timestamp,
                'sport': sport,
                'avg_heart_rate': avg_heart_rate,
                'max_heart_rate': max_heart_rate,
                'total_elapsed_time': total_elapsed_time,
                'distance': distance,
                'hrv': hrv,
                'fat': fat,
                'total_fat': total_fat,
                'carbs': carbs,
                'total_carbs': total_carbs,
                'VO2maxSmooth': VO2maxSmooth,
                'VO2maxSession': VO2maxSession,
                'CardiacDrift': CardiacDrift,
                'CooperTest': CooperTest,
                'steps': steps,
                'stress_hrpa': stress_hrpa,
                'HR_RS_Deviation_Index': HR_RS_Deviation_Index,
                'hrv_sdrr_f': hrv_sdrr_f,
                'hrv_pnn50': hrv_pnn50,
                'hrv_pnn20': hrv_pnn20,
                'rmssd': rmssd,
                'aarmssd': aarmssd,
                'lnrmssd': lnrmssd,
                'sdnn': sdnn,
                'aasdnn': aasdnn,
                'sdsd': sdsd,
                'nn50': nn50,
                'nn20': nn20,
                'pnn20': pnn20,
                'Long': Long,
                'Short': Short,
                'Ectopic_S': Ectopic_S,
                'hrv_rmssd': hrv_rmssd,
                'SD2': SD2,
                'SD1': SD1,
                'LF': LF,
                'HF': HF,
                'VLF': VLF,
                'pNN50': pNN50,
                'LFnu': LFnu,
                'HFnu': HFnu,
                'MeanHR': MeanHR,
                'MeanRR': MeanRR,
                'Running_Economy': Running_Economy,
                'aHRV': aHRV,
                'arMSSD': arMSSD,
                'aSDNN': aSDNN,
                'calories': calories,
                'total_calories': total_calories,
                'total_training_effect': total_training_effect,
                'recovery_heart_rate': recovery_heart_rate,
                'aerobic_efficiency': aerobic_efficiency,
                'estimated_sweat_loss_ml': estimated_sweat_loss_ml,
                'avg_cadence': avg_cadence,
                'max_cadence': max_cadence,
                'total_strides': total_strides,
                'total_cycles': total_cycles,
                'total_distance': total_distance,
                'total_ascent': total_ascent,
                'total_descent': total_descent
            })
            logging.info(f'Parsed session data for activity ID {activity_id}.')
    return session_data

def insert_data_into_db(data):
    conn = sqlite3.connect('c:/smakrykoDBs/artemis.db')
    cursor = conn.cursor()

    # EXACT column order matching table
    columns = [
        'activity_id', 'name', 'timestamp', 'sport', 'avg_heart_rate', 'max_heart_rate', 
        'total_elapsed_time', 'distance', 'hrv', 'fat', 'total_fat', 'carbs', 'total_carbs', 
        'VO2maxSmooth', 'VO2maxSession', 'CardiacDrift', 'CooperTest', 'steps', 
        'stress_hrpa', 'HR_RS_Deviation_Index', 'hrv_sdrr_f', 'hrv_pnn50', 'hrv_pnn20', 
        'rmssd', 'aarmssd', 'lnrmssd', 'sdnn', 'aasdnn', 'sdsd', 'nn50', 'nn20', 
        'pnn20', 'Long', 'Short', 'Ectopic_S', 'hrv_rmssd', 'SD2', 'SD1', 'LF', 
        'HF', 'VLF', 'pNN50', 'LFnu', 'HFnu', 'MeanHR', 'MeanRR', 'Running_Economy', 
        'aHRV', 'arMSSD', 'aSDNN', 'calories', 'total_calories', 'total_training_effect', 
        'recovery_heart_rate', 'aerobic_efficiency', 'estimated_sweat_loss_ml', 'avg_cadence', 'max_cadence', 'total_strides',
        'total_cycles', 'total_distance', 'total_ascent', 'total_descent'
    ]
    
    specific_fields = ['fat','total_fat','carbs','total_carbs','VO2maxSmooth','sport',
                      'avg_heart_rate','max_heart_rate','total_elapsed_time','VO2maxSession',
                      'timestamp','CardiacDrift','CooperTest','steps','stress_hrpa',
                      'HR_RS_Deviation_Index','hrv_sdrr_f','hrv_pnn50','hrv_pnn20','rmssd',
                      'aarmssd','lnrmssd','sdnn','aasdnn','sdsd','nn50','nn20','pnn20',
                      'Long','Short','Ectopic_S','hrv_rmssd','SD2','SD1','LF','HF','VLF',
                      'pNN50','LFnu','HFnu','MeanHR','MeanRR','Running_Economy','aHRV',
                      'arMSSD','aSDNN','calories','total_calories','estimated_sweat_loss_ml','avg_cadence',
                      'total_cycles','total_distance','total_ascent','total_descent']

    placeholders = ','.join('?' * len(columns))
    column_names = ','.join(columns)

    for session in data:
        if all(session.get(field) is None for field in specific_fields):
            continue

        values = [session.get(col, None) for col in columns]
        
        cursor.execute(f'''
            INSERT OR REPLACE INTO adv_Artemistbl_Fields 
            ({column_names}) VALUES ({placeholders})
        ''', values)

    conn.commit()
    conn.close()


def create_view_if_not_exists():
    conn = sqlite3.connect('c:/smakrykoDBs/artemis.db')
    cursor = conn.cursor()

    cursor.execute('''
        CREATE VIEW IF NOT EXISTS RunFields_view AS
        SELECT activities.*
        FROM activities
        INNER JOIN adv_Artemistbl_Fields ON activities.activity_id = adv_Artemistbl_Fields.activity_id
        WHERE adv_Artemistbl_Fields.sport = "running" ORDER BY adv_Artemistbl_Fields.timestamp DESC
    ''')
    logging.info('View for Run created successfully.')
    conn.commit()
    conn.close()


if __name__ == "__main__":  
    create_table_if_not_exists()
    create_view_if_not_exists()
    # all_session_data = parse_all_fit_files_in_folder(r'C:/SmakrykoDev/GitHubRepos/MS-Buddy-Fitness-App/utilities-tools/fit_test_files')
    # # all_session_data = parse_all_fit_files_in_folder(r'C:/smakryko/MS-Buddy-Fitness-App/utilities-tools/fit_test_files')
    all_session_data = parse_all_fit_files_in_folder('c:/users/djsco/jheelhealthdatav2/fitfiles/activities')
    # all_session_data = parse_all_fit_files_in_folder('c:/smakrykoDev/Meggelan/Apex/runAnalyze')
    insert_data_into_db(all_session_data)
    logging.info('All data inserted successfully.')
    print('All data inserted successfully.')
    logging.info('Script completed successfully.')
    print('Script completed successfully.')
