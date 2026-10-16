import math
from typing import List

def calculate_acwr(daily_loads: List[float]) -> float:
    """
    Calculates the Acute:Chronic Workload Ratio (ACWR).
    
    :param daily_loads: A list of daily training loads spanning at least 28 days.
    :return: The ratio of 7-day average load to 28-day average load.
    """
    if len(daily_loads) < 28:
        raise ValueError("daily_loads must contain at least 28 days of data.")
    
    # Take the most recent 7 days for acute and 28 days for chronic
    acute_load = sum(daily_loads[-7:]) / 7.0
    chronic_load = sum(daily_loads[-28:]) / 28.0
    
    if chronic_load == 0:
        return 0.0
        
    return acute_load / chronic_load


def calculate_trimp(duration_min: float, hr_exercise: float, hr_rest: float, hr_max: float, gender: str = "male") -> float:
    """
    Calculates Banister's Training Impulse (TRIMP).
    
    :param duration_min: Duration of the workout in minutes.
    :param hr_exercise: Average heart rate during exercise (bpm).
    :param hr_rest: Resting heart rate (bpm).
    :param hr_max: Maximum heart rate (bpm).
    :param gender: 'male' or 'female' (determines exponential coefficient b).
    :return: TRIMP score.
    """
    if hr_max <= hr_rest:
        raise ValueError("hr_max must be strictly greater than hr_rest.")
    
    # Heart Rate Reserve Ratio (HRr)
    hr_ratio = (hr_exercise - hr_rest) / (hr_max - hr_rest)
    
    # Banister exponential parameters for gender
    if gender.lower() == "male":
        b = 1.92
        k = 0.64
    elif gender.lower() == "female":
        b = 1.67
        k = 0.86
    else:
        raise ValueError("Gender must be 'male' or 'female'.")
    
    return duration_min * hr_ratio * k * math.exp(b * hr_ratio)


def calculate_ef(normalized_value: float, avg_hr: float) -> float:
    """
    Calculates the Efficiency Factor (EF).
    
    :param normalized_value: Normalized Power (Watts) or Normalized Graded Pace (m/s or speed eq).
    :param avg_hr: Average heart rate during the activity (bpm).
    :return: Efficiency Factor.
    """
    if avg_hr <= 0:
        raise ValueError("Average heart rate must be greater than zero.")
        
    return normalized_value / avg_hr


def calculate_pi(normalized_value: float, threshold: float) -> float:
    """
    Calculates Performance Intensity / Intensity Factor (IF).
    
    :param normalized_value: Normalized Power or Pace during session.
    :param threshold: Functional Threshold Power (FTP) or Critical Speed in matching units.
    :return: Intensity Factor ratio.
    """
    if threshold <= 0:
        raise ValueError("Threshold must be greater than zero.")
        
    return normalized_value / threshold


def calculate_tsb(yesterday_ctl: float, yesterday_atl: float) -> float:
    """
    Calculates Training Stress Balance (TSB / Fatigue Index).
    
    :param yesterday_ctl: Yesterday's Chronic Training Load (Fitness).
    :param yesterday_atl: Yesterday's Acute Training Load (Fatigue).
    :return: Training Stress Balance (Form/Readiness).
    """
    return yesterday_ctl - yesterday_atl