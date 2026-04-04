python garmin_hrv_plots.py \
  --rr-csv 22333218509_ACTIVITY_rr_intervals.csv \
  --rolling-csv 22333218509_ACTIVITY_hrv_rolling.csv


  python garmin_hrv_extract.py 22333218509_ACTIVITY.fit

pip install pandas numpy matplotlib
pip install fitparse pandas numpy
pip install fitdecode pandas numpy
python garmin_hrv_extract_fitdecode.py demoHRV.fit