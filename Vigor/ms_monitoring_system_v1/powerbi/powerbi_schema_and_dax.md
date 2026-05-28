
# Power BI Model and DAX Measures

## Tables
- Date
- HRV_Data
- Sleep_Data
- Activity_Data
- Symptoms_Log
- Relapse_Events
- Treatment_Log
- Derived_Metrics

## Relationships
- Date[Date] 1:* HRV_Data[date]
- Date[Date] 1:* Sleep_Data[date]
- Date[Date] 1:* Activity_Data[date]
- Date[Date] 1:* Symptoms_Log[date]
- Date[Date] 1:* Derived_Metrics[date]

## Core DAX Measures

```DAX
RMSSD 7D Avg =
AVERAGEX(
    DATESINPERIOD('Date'[Date], MAX('Date'[Date]), -7, DAY),
    AVERAGE(HRV_Data[rmssd_ms])
)

RMSSD 60D Baseline =
AVERAGEX(
    DATESINPERIOD('Date'[Date], MAX('Date'[Date]) - 1, -60, DAY),
    AVERAGE(HRV_Data[rmssd_ms])
)

HRV Drop % =
DIVIDE([RMSSD 60D Baseline] - [RMSSD 7D Avg], [RMSSD 60D Baseline]) * 100

RHR 7D Avg =
AVERAGEX(
    DATESINPERIOD('Date'[Date], MAX('Date'[Date]), -7, DAY),
    AVERAGE(HRV_Data[resting_hr_bpm])
)

RHR 60D Baseline =
AVERAGEX(
    DATESINPERIOD('Date'[Date], MAX('Date'[Date]) - 1, -60, DAY),
    AVERAGE(HRV_Data[resting_hr_bpm])
)

RHR Rise % =
DIVIDE([RHR 7D Avg] - [RHR 60D Baseline], [RHR 60D Baseline]) * 100

Fatigue 7D Avg =
AVERAGEX(
    DATESINPERIOD('Date'[Date], MAX('Date'[Date]), -7, DAY),
    AVERAGE(Symptoms_Log[fatigue_0_10])
)

Relapse Risk Band =
SWITCH(
    TRUE(),
    AVERAGE(Derived_Metrics[risk_score]) >= 65, "Red",
    AVERAGE(Derived_Metrics[risk_score]) >= 35, "Yellow",
    "Green"
)
```

## Recommended Dashboard Pages

### 1. MS Command Center
- Current risk band
- 7-day risk score trend
- HRV drop %
- RHR rise %
- fatigue trend
- sleep deficit
- symptom burden

### 2. Autonomic / HRV
- RMSSD vs baseline
- resting HR vs baseline
- HRV suppression index
- confounder flags

### 3. Symptoms
- fatigue, cognition, balance, pain, spasticity
- heat exposure / infection flags
- notes table

### 4. Relapse Timeline
- relapse events
- steroid use
- MRI activity
- treatment changes

### 5. Weekly Report
- latest weekly status
- contributing factors
- recommended discussion points for neurologist
```
