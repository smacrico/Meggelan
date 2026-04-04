# commands to run
# ###############################################################
# #############

# Hydra #######
# blood analysis platform
```bash
python main.py --config config/config.json --profile lipidemic
```

```bash
python main.py --config config/config.json --profile all
```

# Apex #####
```bash
& C:/Python314/python.exe C:/Users/djsco/AppData/Roaming/Python/Python314/Scripts/garmindb_cli.py --all --download --import --analyze --latest


```bash
& C:/Python313/python.exe "C:/smakrykoDev/GitHub_dls/MS-Buddy-Fitness-App/utilities-tools/jHeel_plugin v6.26.py"
& C:/Python313/python.exe "C:/smakrykoDev/Meggelan/Apex/runningAnalysis/createRunAnalDB - v6.26.py"


```bash
python main.py 
```
### older, before update :
```bash
& C:/Python313/python.exe c:/smakrykoDev/GitHub_dls/MS-Buddy-Fitness-App/APEX-RunAnalysis/Dev_Scripts/RunningAnalysis_v6.26-Dev.py
```

# hrvAnalysis #######
# hrv_platform
### 1. Initialize DB

```bash
python -m hrv_platform.cli init-db
```

---

### 2. Sync Data from Artemis

```bash
python -m hrv_platform.cli sync-artemis
```

### 3. Start API Server

```bash
python -m hrv_platform.cli serve
```