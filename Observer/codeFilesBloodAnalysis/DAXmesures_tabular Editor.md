-- =========================================================
-- COMMON
-- =========================================================

Latest Selected Date =
MAX(Dim_Date[Date])

Previous Selected Date =
CALCULATE(
    MAX(Dim_Date[Date]),
    FILTER(
        ALLSELECTED(Dim_Date[Date]),
        Dim_Date[Date] < [Latest Selected Date]
    )
)

Test Count =
COUNTROWS(VALUES(Dim_Date[Date]))

Days Between Latest And Previous Test =
DATEDIFF([Previous Selected Date], [Latest Selected Date], DAY)


-- =========================================================
-- LIPID - LATEST
-- =========================================================

Lipid Latest Total Cholesterol =
CALCULATE(
    MAX(Fact_LipidMetrics[total_cholesterol]),
    TREATAS({[Latest Selected Date]}, Fact_LipidMetrics[exam_date])
)

Lipid Latest HDL =
CALCULATE(
    MAX(Fact_LipidMetrics[hdl]),
    TREATAS({[Latest Selected Date]}, Fact_LipidMetrics[exam_date])
)

Lipid Latest LDL Final =
CALCULATE(
    MAX(Fact_LipidMetrics[ldl_final]),
    TREATAS({[Latest Selected Date]}, Fact_LipidMetrics[exam_date])
)

Lipid Latest Triglycerides =
CALCULATE(
    MAX(Fact_LipidMetrics[triglycerides]),
    TREATAS({[Latest Selected Date]}, Fact_LipidMetrics[exam_date])
)

Lipid Latest Non-HDL =
CALCULATE(
    MAX(Fact_LipidMetrics[non_hdl_final]),
    TREATAS({[Latest Selected Date]}, Fact_LipidMetrics[exam_date])
)

Lipid Latest TC/HDL =
CALCULATE(
    MAX(Fact_LipidMetrics[tc_hdl_ratio]),
    TREATAS({[Latest Selected Date]}, Fact_LipidMetrics[exam_date])
)

Lipid Latest LDL/HDL =
CALCULATE(
    MAX(Fact_LipidMetrics[ldl_hdl_ratio]),
    TREATAS({[Latest Selected Date]}, Fact_LipidMetrics[exam_date])
)

Lipid Latest TG/HDL =
CALCULATE(
    MAX(Fact_LipidMetrics[tg_hdl_ratio]),
    TREATAS({[Latest Selected Date]}, Fact_LipidMetrics[exam_date])
)

Lipid Latest AIP =
CALCULATE(
    MAX(Fact_LipidMetrics[aip]),
    TREATAS({[Latest Selected Date]}, Fact_LipidMetrics[exam_date])
)

Lipid Latest Remnant =
CALCULATE(
    MAX(Fact_LipidMetrics[remnant_cholesterol]),
    TREATAS({[Latest Selected Date]}, Fact_LipidMetrics[exam_date])
)

Lipid Latest Lp(a) =
CALCULATE(
    MAX(Fact_LipidMetrics[lpa]),
    TREATAS({[Latest Selected Date]}, Fact_LipidMetrics[exam_date])
)


-- =========================================================
-- LIPID - PREVIOUS
-- =========================================================

Lipid Previous Total Cholesterol =
CALCULATE(
    MAX(Fact_LipidMetrics[total_cholesterol]),
    TREATAS({[Previous Selected Date]}, Fact_LipidMetrics[exam_date])
)

Lipid Previous HDL =
CALCULATE(
    MAX(Fact_LipidMetrics[hdl]),
    TREATAS({[Previous Selected Date]}, Fact_LipidMetrics[exam_date])
)

Lipid Previous LDL Final =
CALCULATE(
    MAX(Fact_LipidMetrics[ldl_final]),
    TREATAS({[Previous Selected Date]}, Fact_LipidMetrics[exam_date])
)

Lipid Previous Triglycerides =
CALCULATE(
    MAX(Fact_LipidMetrics[triglycerides]),
    TREATAS({[Previous Selected Date]}, Fact_LipidMetrics[exam_date])
)

Lipid Previous Non-HDL =
CALCULATE(
    MAX(Fact_LipidMetrics[non_hdl_final]),
    TREATAS({[Previous Selected Date]}, Fact_LipidMetrics[exam_date])
)

Lipid Previous TC/HDL =
CALCULATE(
    MAX(Fact_LipidMetrics[tc_hdl_ratio]),
    TREATAS({[Previous Selected Date]}, Fact_LipidMetrics[exam_date])
)

Lipid Previous LDL/HDL =
CALCULATE(
    MAX(Fact_LipidMetrics[ldl_hdl_ratio]),
    TREATAS({[Previous Selected Date]}, Fact_LipidMetrics[exam_date])
)

Lipid Previous TG/HDL =
CALCULATE(
    MAX(Fact_LipidMetrics[tg_hdl_ratio]),
    TREATAS({[Previous Selected Date]}, Fact_LipidMetrics[exam_date])
)

Lipid Previous AIP =
CALCULATE(
    MAX(Fact_LipidMetrics[aip]),
    TREATAS({[Previous Selected Date]}, Fact_LipidMetrics[exam_date])
)

Lipid Previous Remnant =
CALCULATE(
    MAX(Fact_LipidMetrics[remnant_cholesterol]),
    TREATAS({[Previous Selected Date]}, Fact_LipidMetrics[exam_date])
)

Lipid Previous Lp(a) =
CALCULATE(
    MAX(Fact_LipidMetrics[lpa]),
    TREATAS({[Previous Selected Date]}, Fact_LipidMetrics[exam_date])
)


-- =========================================================
-- LIPID - DELTA
-- =========================================================

Lipid Total Cholesterol Delta =
[Lipid Latest Total Cholesterol] - [Lipid Previous Total Cholesterol]

Lipid HDL Delta =
[Lipid Latest HDL] - [Lipid Previous HDL]

Lipid LDL Final Delta =
[Lipid Latest LDL Final] - [Lipid Previous LDL Final]

Lipid TG Delta =
[Lipid Latest Triglycerides] - [Lipid Previous Triglycerides]

Lipid Non-HDL Delta =
[Lipid Latest Non-HDL] - [Lipid Previous Non-HDL]

Lipid TC/HDL Delta =
[Lipid Latest TC/HDL] - [Lipid Previous TC/HDL]

Lipid LDL/HDL Delta =
[Lipid Latest LDL/HDL] - [Lipid Previous LDL/HDL]

Lipid TG/HDL Delta =
[Lipid Latest TG/HDL] - [Lipid Previous TG/HDL]

Lipid AIP Delta =
[Lipid Latest AIP] - [Lipid Previous AIP]

Lipid Remnant Delta =
[Lipid Latest Remnant] - [Lipid Previous Remnant]

Lipid Lp(a) Delta =
[Lipid Latest Lp(a)] - [Lipid Previous Lp(a)]


-- =========================================================
-- LIPID - DELTA %
-- =========================================================

Lipid Total Cholesterol Delta % =
DIVIDE([Lipid Total Cholesterol Delta], [Lipid Previous Total Cholesterol])

Lipid HDL Delta % =
DIVIDE([Lipid HDL Delta], [Lipid Previous HDL])

Lipid LDL Final Delta % =
DIVIDE([Lipid LDL Final Delta], [Lipid Previous LDL Final])

Lipid TG Delta % =
DIVIDE([Lipid TG Delta], [Lipid Previous Triglycerides])

Lipid Non-HDL Delta % =
DIVIDE([Lipid Non-HDL Delta], [Lipid Previous Non-HDL])

Lipid TC/HDL Delta % =
DIVIDE([Lipid TC/HDL Delta], [Lipid Previous TC/HDL])

Lipid LDL/HDL Delta % =
DIVIDE([Lipid LDL/HDL Delta], [Lipid Previous LDL/HDL])

Lipid TG/HDL Delta % =
DIVIDE([Lipid TG/HDL Delta], [Lipid Previous TG/HDL])

Lipid AIP Delta % =
DIVIDE([Lipid AIP Delta], [Lipid Previous AIP])

Lipid Remnant Delta % =
DIVIDE([Lipid Remnant Delta], [Lipid Previous Remnant])

Lipid Lp(a) Delta % =
DIVIDE([Lipid Lp(a) Delta], [Lipid Previous Lp(a)])


-- =========================================================
-- LIPID - ROLLING 3
-- =========================================================

Lipid Total Cholesterol Rolling 3 =
AVERAGEX(
    TOPN(
        3,
        ALLSELECTED(Fact_LipidMetrics[exam_date]),
        Fact_LipidMetrics[exam_date], DESC
    ),
    CALCULATE(MAX(Fact_LipidMetrics[total_cholesterol]))
)

Lipid HDL Rolling 3 =
AVERAGEX(
    TOPN(
        3,
        ALLSELECTED(Fact_LipidMetrics[exam_date]),
        Fact_LipidMetrics[exam_date], DESC
    ),
    CALCULATE(MAX(Fact_LipidMetrics[hdl]))
)

Lipid LDL Final Rolling 3 =
AVERAGEX(
    TOPN(
        3,
        ALLSELECTED(Fact_LipidMetrics[exam_date]),
        Fact_LipidMetrics[exam_date], DESC
    ),
    CALCULATE(MAX(Fact_LipidMetrics[ldl_final]))
)

Lipid TG Rolling 3 =
AVERAGEX(
    TOPN(
        3,
        ALLSELECTED(Fact_LipidMetrics[exam_date]),
        Fact_LipidMetrics[exam_date], DESC
    ),
    CALCULATE(MAX(Fact_LipidMetrics[triglycerides]))
)

Lipid Non-HDL Rolling 3 =
AVERAGEX(
    TOPN(
        3,
        ALLSELECTED(Fact_LipidMetrics[exam_date]),
        Fact_LipidMetrics[exam_date], DESC
    ),
    CALCULATE(MAX(Fact_LipidMetrics[non_hdl_final]))
)

Lipid AIP Rolling 3 =
AVERAGEX(
    TOPN(
        3,
        ALLSELECTED(Fact_LipidMetrics[exam_date]),
        Fact_LipidMetrics[exam_date], DESC
    ),
    CALCULATE(MAX(Fact_LipidMetrics[aip]))
)

Lipid TG/HDL Rolling 3 =
AVERAGEX(
    TOPN(
        3,
        ALLSELECTED(Fact_LipidMetrics[exam_date]),
        Fact_LipidMetrics[exam_date], DESC
    ),
    CALCULATE(MAX(Fact_LipidMetrics[tg_hdl_ratio]))
)

Lipid Remnant Rolling 3 =
AVERAGEX(
    TOPN(
        3,
        ALLSELECTED(Fact_LipidMetrics[exam_date]),
        Fact_LipidMetrics[exam_date], DESC
    ),
    CALCULATE(MAX(Fact_LipidMetrics[remnant_cholesterol]))
)


-- =========================================================
-- LIPID - TREND DIRECTION
-- =========================================================

Lipid Total Cholesterol Trend Direction =
VAR d = [Lipid Total Cholesterol Delta]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(d), BLANK(),
    d < 0, "Improving",
    d > 0, "Worsening",
    "Stable"
)

Lipid HDL Trend Direction =
VAR d = [Lipid HDL Delta]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(d), BLANK(),
    d > 0, "Improving",
    d < 0, "Worsening",
    "Stable"
)

Lipid LDL Final Trend Direction =
VAR d = [Lipid LDL Final Delta]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(d), BLANK(),
    d < 0, "Improving",
    d > 0, "Worsening",
    "Stable"
)

Lipid TG Trend Direction =
VAR d = [Lipid TG Delta]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(d), BLANK(),
    d < 0, "Improving",
    d > 0, "Worsening",
    "Stable"
)

Lipid Non-HDL Trend Direction =
VAR d = [Lipid Non-HDL Delta]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(d), BLANK(),
    d < 0, "Improving",
    d > 0, "Worsening",
    "Stable"
)

Lipid AIP Trend Direction =
VAR d = [Lipid AIP Delta]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(d), BLANK(),
    d < 0, "Improving",
    d > 0, "Worsening",
    "Stable"
)

Lipid TG/HDL Trend Direction =
VAR d = [Lipid TG/HDL Delta]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(d), BLANK(),
    d < 0, "Improving",
    d > 0, "Worsening",
    "Stable"
)

Lipid Remnant Trend Direction =
VAR d = [Lipid Remnant Delta]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(d), BLANK(),
    d < 0, "Improving",
    d > 0, "Worsening",
    "Stable"
)


-- =========================================================
-- LIPID - SCORES
-- =========================================================

Lipid AIP Score =
VAR x = [Lipid Latest AIP]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 0.11, 1,
    x < 0.21, 2,
    3
)

Lipid TG/HDL Score =
VAR x = [Lipid Latest TG/HDL]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 2, 1,
    x < 3, 2,
    x < 4, 3,
    4
)

Lipid Remnant Score =
VAR x = [Lipid Latest Remnant]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 20, 1,
    x <= 30, 2,
    3
)

Lipid TC/HDL Score =
VAR x = [Lipid Latest TC/HDL]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 4, 1,
    x < 5, 2,
    3
)

Lipid LDL/HDL Score =
VAR x = [Lipid Latest LDL/HDL]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 2, 1,
    x < 3, 2,
    3
)

Lipid Non-HDL Score =
VAR x = [Lipid Latest Non-HDL]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 130, 1,
    x < 160, 2,
    x < 190, 3,
    4
)


-- =========================================================
-- LIPID - INDICATORS
-- =========================================================

Lipid AIP Indicator =
SWITCH(
    [Lipid AIP Score],
    1, "Low risk",
    2, "Intermediate risk",
    3, "High risk",
    BLANK()
)

Lipid TG/HDL Indicator =
SWITCH(
    [Lipid TG/HDL Score],
    1, "Favorable",
    2, "Borderline",
    3, "Higher risk",
    4, "Marked metabolic-risk signal",
    BLANK()
)

Lipid Remnant Indicator =
SWITCH(
    [Lipid Remnant Score],
    1, "Favorable",
    2, "Borderline",
    3, "Higher residual risk",
    BLANK()
)

Lipid TC/HDL Indicator =
SWITCH(
    [Lipid TC/HDL Score],
    1, "Favorable",
    2, "Borderline",
    3, "Higher risk",
    BLANK()
)

Lipid LDL/HDL Indicator =
SWITCH(
    [Lipid LDL/HDL Score],
    1, "Favorable",
    2, "Borderline",
    3, "Less favorable",
    BLANK()
)

Lipid Non-HDL Indicator =
SWITCH(
    [Lipid Non-HDL Score],
    1, "Optimal / near-optimal",
    2, "Borderline high",
    3, "High",
    4, "Very high",
    BLANK()
)


-- =========================================================
-- LIPID - COMPOSITE KPI
-- =========================================================

Lipid Composite Risk Score =
AVERAGEX(
    {
        [Lipid AIP Score],
        [Lipid TG/HDL Score],
        [Lipid Remnant Score],
        [Lipid TC/HDL Score],
        [Lipid LDL/HDL Score],
        [Lipid Non-HDL Score]
    },
    [Value]
)

Lipid Composite KPI =
VAR x = [Lipid Composite Risk Score]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x <= 1.5, "Favorable",
    x <= 2.3, "Monitor",
    x <= 3.2, "Elevated risk pattern",
    "High concern"
)

Lipid Composite Color Hex =
VAR x = [Lipid Composite Risk Score]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x <= 1.5, "#2E7D32",
    x <= 2.3, "#F9A825",
    x <= 3.2, "#EF6C00",
    "#C62828"
)


-- =========================================================
-- LIPID - STABILITY
-- =========================================================

Lipid AIP Stability KPI =
VAR curr = [Lipid Latest AIP]
VAR avg3 = [Lipid AIP Rolling 3]
RETURN
ABS(curr - avg3)

Lipid TG/HDL Stability KPI =
VAR curr = [Lipid Latest TG/HDL]
VAR avg3 = [Lipid TG/HDL Rolling 3]
RETURN
ABS(curr - avg3)

Lipid Remnant Stability KPI =
VAR curr = [Lipid Latest Remnant]
VAR avg3 = [Lipid Remnant Rolling 3]
RETURN
ABS(curr - avg3)


-- =========================================================
-- ENDO - LATEST
-- =========================================================

Endo Latest Glucose =
CALCULATE(
    MAX(Fact_EndoMetrics[glucose_for_calc]),
    TREATAS({[Latest Selected Date]}, Fact_EndoMetrics[exam_date])
)

Endo Latest Fasting Insulin =
CALCULATE(
    MAX(Fact_EndoMetrics[fasting_insulin]),
    TREATAS({[Latest Selected Date]}, Fact_EndoMetrics[exam_date])
)

Endo Latest HbA1c =
CALCULATE(
    MAX(Fact_EndoMetrics[hba1c]),
    TREATAS({[Latest Selected Date]}, Fact_EndoMetrics[exam_date])
)

Endo Latest eAG =
CALCULATE(
    MAX(Fact_EndoMetrics[eag_mgdl]),
    TREATAS({[Latest Selected Date]}, Fact_EndoMetrics[exam_date])
)

Endo Latest HOMA-IR =
CALCULATE(
    MAX(Fact_EndoMetrics[homa_ir]),
    TREATAS({[Latest Selected Date]}, Fact_EndoMetrics[exam_date])
)

Endo Latest QUICKI =
CALCULATE(
    MAX(Fact_EndoMetrics[quicki]),
    TREATAS({[Latest Selected Date]}, Fact_EndoMetrics[exam_date])
)

Endo Latest TSH =
CALCULATE(
    MAX(Fact_EndoMetrics[tsh]),
    TREATAS({[Latest Selected Date]}, Fact_EndoMetrics[exam_date])
)

Endo Latest Free T4 =
CALCULATE(
    MAX(Fact_EndoMetrics[free_t4]),
    TREATAS({[Latest Selected Date]}, Fact_EndoMetrics[exam_date])
)

Endo Latest TSH/Free T4 Ratio =
CALCULATE(
    MAX(Fact_EndoMetrics[tsh_free_t4_ratio]),
    TREATAS({[Latest Selected Date]}, Fact_EndoMetrics[exam_date])
)

Endo Latest Vitamin D =
CALCULATE(
    MAX(Fact_EndoMetrics[vitamin_d_25_oh]),
    TREATAS({[Latest Selected Date]}, Fact_EndoMetrics[exam_date])
)


-- =========================================================
-- ENDO - PREVIOUS
-- =========================================================

Endo Previous Glucose =
CALCULATE(
    MAX(Fact_EndoMetrics[glucose_for_calc]),
    TREATAS({[Previous Selected Date]}, Fact_EndoMetrics[exam_date])
)

Endo Previous Fasting Insulin =
CALCULATE(
    MAX(Fact_EndoMetrics[fasting_insulin]),
    TREATAS({[Previous Selected Date]}, Fact_EndoMetrics[exam_date])
)

Endo Previous HbA1c =
CALCULATE(
    MAX(Fact_EndoMetrics[hba1c]),
    TREATAS({[Previous Selected Date]}, Fact_EndoMetrics[exam_date])
)

Endo Previous eAG =
CALCULATE(
    MAX(Fact_EndoMetrics[eag_mgdl]),
    TREATAS({[Previous Selected Date]}, Fact_EndoMetrics[exam_date])
)

Endo Previous HOMA-IR =
CALCULATE(
    MAX(Fact_EndoMetrics[homa_ir]),
    TREATAS({[Previous Selected Date]}, Fact_EndoMetrics[exam_date])
)

Endo Previous QUICKI =
CALCULATE(
    MAX(Fact_EndoMetrics[quicki]),
    TREATAS({[Previous Selected Date]}, Fact_EndoMetrics[exam_date])
)

Endo Previous TSH =
CALCULATE(
    MAX(Fact_EndoMetrics[tsh]),
    TREATAS({[Previous Selected Date]}, Fact_EndoMetrics[exam_date])
)

Endo Previous Free T4 =
CALCULATE(
    MAX(Fact_EndoMetrics[free_t4]),
    TREATAS({[Previous Selected Date]}, Fact_EndoMetrics[exam_date])
)

Endo Previous TSH/Free T4 Ratio =
CALCULATE(
    MAX(Fact_EndoMetrics[tsh_free_t4_ratio]),
    TREATAS({[Previous Selected Date]}, Fact_EndoMetrics[exam_date])
)

Endo Previous Vitamin D =
CALCULATE(
    MAX(Fact_EndoMetrics[vitamin_d_25_oh]),
    TREATAS({[Previous Selected Date]}, Fact_EndoMetrics[exam_date])
)


-- =========================================================
-- ENDO - DELTA
-- =========================================================

Endo Glucose Delta =
[Endo Latest Glucose] - [Endo Previous Glucose]

Endo Fasting Insulin Delta =
[Endo Latest Fasting Insulin] - [Endo Previous Fasting Insulin]

Endo HbA1c Delta =
[Endo Latest HbA1c] - [Endo Previous HbA1c]

Endo eAG Delta =
[Endo Latest eAG] - [Endo Previous eAG]

Endo HOMA-IR Delta =
[Endo Latest HOMA-IR] - [Endo Previous HOMA-IR]

Endo QUICKI Delta =
[Endo Latest QUICKI] - [Endo Previous QUICKI]

Endo TSH Delta =
[Endo Latest TSH] - [Endo Previous TSH]

Endo Free T4 Delta =
[Endo Latest Free T4] - [Endo Previous Free T4]

Endo TSH/Free T4 Ratio Delta =
[Endo Latest TSH/Free T4 Ratio] - [Endo Previous TSH/Free T4 Ratio]

Endo Vitamin D Delta =
[Endo Latest Vitamin D] - [Endo Previous Vitamin D]


-- =========================================================
-- ENDO - DELTA %
-- =========================================================

Endo Glucose Delta % =
DIVIDE([Endo Glucose Delta], [Endo Previous Glucose])

Endo Fasting Insulin Delta % =
DIVIDE([Endo Fasting Insulin Delta], [Endo Previous Fasting Insulin])

Endo HbA1c Delta % =
DIVIDE([Endo HbA1c Delta], [Endo Previous HbA1c])

Endo eAG Delta % =
DIVIDE([Endo eAG Delta], [Endo Previous eAG])

Endo HOMA-IR Delta % =
DIVIDE([Endo HOMA-IR Delta], [Endo Previous HOMA-IR])

Endo QUICKI Delta % =
DIVIDE([Endo QUICKI Delta], [Endo Previous QUICKI])

Endo TSH Delta % =
DIVIDE([Endo TSH Delta], [Endo Previous TSH])

Endo Free T4 Delta % =
DIVIDE([Endo Free T4 Delta], [Endo Previous Free T4])

Endo TSH/Free T4 Ratio Delta % =
DIVIDE([Endo TSH/Free T4 Ratio Delta], [Endo Previous TSH/Free T4 Ratio])

Endo Vitamin D Delta % =
DIVIDE([Endo Vitamin D Delta], [Endo Previous Vitamin D])


-- =========================================================
-- ENDO - ROLLING 3
-- =========================================================

Endo Glucose Rolling 3 =
AVERAGEX(
    TOPN(
        3,
        ALLSELECTED(Fact_EndoMetrics[exam_date]),
        Fact_EndoMetrics[exam_date], DESC
    ),
    CALCULATE(MAX(Fact_EndoMetrics[glucose_for_calc]))
)

Endo Fasting Insulin Rolling 3 =
AVERAGEX(
    TOPN(
        3,
        ALLSELECTED(Fact_EndoMetrics[exam_date]),
        Fact_EndoMetrics[exam_date], DESC
    ),
    CALCULATE(MAX(Fact_EndoMetrics[fasting_insulin]))
)

Endo HbA1c Rolling 3 =
AVERAGEX(
    TOPN(
        3,
        ALLSELECTED(Fact_EndoMetrics[exam_date]),
        Fact_EndoMetrics[exam_date], DESC
    ),
    CALCULATE(MAX(Fact_EndoMetrics[hba1c]))
)

Endo eAG Rolling 3 =
AVERAGEX(
    TOPN(
        3,
        ALLSELECTED(Fact_EndoMetrics[exam_date]),
        Fact_EndoMetrics[exam_date], DESC
    ),
    CALCULATE(MAX(Fact_EndoMetrics[eag_mgdl]))
)

Endo HOMA-IR Rolling 3 =
AVERAGEX(
    TOPN(
        3,
        ALLSELECTED(Fact_EndoMetrics[exam_date]),
        Fact_EndoMetrics[exam_date], DESC
    ),
    CALCULATE(MAX(Fact_EndoMetrics[homa_ir]))
)

Endo QUICKI Rolling 3 =
AVERAGEX(
    TOPN(
        3,
        ALLSELECTED(Fact_EndoMetrics[exam_date]),
        Fact_EndoMetrics[exam_date], DESC
    ),
    CALCULATE(MAX(Fact_EndoMetrics[quicki]))
)

Endo TSH Rolling 3 =
AVERAGEX(
    TOPN(
        3,
        ALLSELECTED(Fact_EndoMetrics[exam_date]),
        Fact_EndoMetrics[exam_date], DESC
    ),
    CALCULATE(MAX(Fact_EndoMetrics[tsh]))
)

Endo Free T4 Rolling 3 =
AVERAGEX(
    TOPN(
        3,
        ALLSELECTED(Fact_EndoMetrics[exam_date]),
        Fact_EndoMetrics[exam_date], DESC
    ),
    CALCULATE(MAX(Fact_EndoMetrics[free_t4]))
)

Endo TSH/Free T4 Ratio Rolling 3 =
AVERAGEX(
    TOPN(
        3,
        ALLSELECTED(Fact_EndoMetrics[exam_date]),
        Fact_EndoMetrics[exam_date], DESC
    ),
    CALCULATE(MAX(Fact_EndoMetrics[tsh_free_t4_ratio]))
)

Endo Vitamin D Rolling 3 =
AVERAGEX(
    TOPN(
        3,
        ALLSELECTED(Fact_EndoMetrics[exam_date]),
        Fact_EndoMetrics[exam_date], DESC
    ),
    CALCULATE(MAX(Fact_EndoMetrics[vitamin_d_25_oh]))
)


-- =========================================================
-- ENDO - TREND DIRECTION
-- =========================================================

Endo Glucose Trend Direction =
VAR d = [Endo Glucose Delta]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(d), BLANK(),
    d < 0, "Improving",
    d > 0, "Worsening",
    "Stable"
)

Endo Fasting Insulin Trend Direction =
VAR d = [Endo Fasting Insulin Delta]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(d), BLANK(),
    d < 0, "Improving",
    d > 0, "Worsening",
    "Stable"
)

Endo HbA1c Trend Direction =
VAR d = [Endo HbA1c Delta]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(d), BLANK(),
    d < 0, "Improving",
    d > 0, "Worsening",
    "Stable"
)

Endo eAG Trend Direction =
VAR d = [Endo eAG Delta]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(d), BLANK(),
    d < 0, "Improving",
    d > 0, "Worsening",
    "Stable"
)

Endo HOMA-IR Trend Direction =
VAR d = [Endo HOMA-IR Delta]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(d), BLANK(),
    d < 0, "Improving",
    d > 0, "Worsening",
    "Stable"
)

Endo QUICKI Trend Direction =
VAR d = [Endo QUICKI Delta]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(d), BLANK(),
    d > 0, "Improving",
    d < 0, "Worsening",
    "Stable"
)

Endo TSH Trend Direction =
VAR d = [Endo TSH Delta]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(d), BLANK(),
    d < 0, "Improving",
    d > 0, "Worsening",
    "Stable"
)

Endo TSH/Free T4 Ratio Trend Direction =
VAR d = [Endo TSH/Free T4 Ratio Delta]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(d), BLANK(),
    d < 0, "Improving",
    d > 0, "Worsening",
    "Stable"
)

Endo Vitamin D Trend Direction =
VAR d = [Endo Vitamin D Delta]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(d), BLANK(),
    d > 0, "Improving",
    d < 0, "Worsening",
    "Stable"
)


-- =========================================================
-- ENDO - SCORES
-- =========================================================

Endo HOMA-IR Score =
VAR x = [Endo Latest HOMA-IR]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 2, 1,
    x < 3, 2,
    3
)

Endo QUICKI Score =
VAR x = [Endo Latest QUICKI]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x >= 0.35, 1,
    x >= 0.30, 2,
    3
)

Endo Vitamin D Score =
VAR x = [Endo Latest Vitamin D]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 20, 3,
    x < 30, 2,
    x <= 100, 1,
    3
)

Endo HbA1c Score =
VAR x = [Endo Latest HbA1c]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 5.7, 1,
    x < 6.5, 2,
    3
)

Endo Glucose Score =
VAR x = [Endo Latest Glucose]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 100, 1,
    x < 126, 2,
    3
)


-- =========================================================
-- ENDO - INDICATORS
-- =========================================================

Endo HOMA-IR Indicator =
SWITCH(
    [Endo HOMA-IR Score],
    1, "Favorable / insulin sensitive",
    2, "Borderline insulin resistance",
    3, "Insulin resistance signal",
    BLANK()
)

Endo QUICKI Indicator =
SWITCH(
    [Endo QUICKI Score],
    1, "Better insulin sensitivity",
    2, "Borderline",
    3, "Lower insulin sensitivity",
    BLANK()
)

Endo Vitamin D Indicator =
VAR x = [Endo Latest Vitamin D]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x < 20, "Deficient",
    x < 30, "Insufficient",
    x <= 50, "Sufficient",
    x <= 100, "High / upper range",
    "Potential excess"
)

Endo HbA1c Indicator =
SWITCH(
    [Endo HbA1c Score],
    1, "Favorable",
    2, "Prediabetes range",
    3, "Diabetes range",
    BLANK()
)

Endo Glucose Indicator =
SWITCH(
    [Endo Glucose Score],
    1, "Favorable",
    2, "Impaired fasting range",
    3, "High fasting glucose range",
    BLANK()
)


-- =========================================================
-- ENDO - COMPOSITE KPI
-- =========================================================

Endo Composite Risk Score =
AVERAGEX(
    {
        [Endo HOMA-IR Score],
        [Endo QUICKI Score],
        [Endo Vitamin D Score],
        [Endo HbA1c Score],
        [Endo Glucose Score]
    },
    [Value]
)

Endo Composite KPI =
VAR x = [Endo Composite Risk Score]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x <= 1.4, "Favorable",
    x <= 2.1, "Monitor",
    x <= 2.8, "Elevated metabolic/endocrine concern",
    "High concern"
)

Endo Composite Color Hex =
VAR x = [Endo Composite Risk Score]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x <= 1.4, "#2E7D32",
    x <= 2.1, "#F9A825",
    x <= 2.8, "#EF6C00",
    "#C62828"
)


-- =========================================================
-- ENDO - STABILITY
-- =========================================================

Endo HOMA-IR Stability KPI =
VAR curr = [Endo Latest HOMA-IR]
VAR avg3 = [Endo HOMA-IR Rolling 3]
RETURN
ABS(curr - avg3)

Endo QUICKI Stability KPI =
VAR curr = [Endo Latest QUICKI]
VAR avg3 = [Endo QUICKI Rolling 3]
RETURN
ABS(curr - avg3)

Endo HbA1c Stability KPI =
VAR curr = [Endo Latest HbA1c]
VAR avg3 = [Endo HbA1c Rolling 3]
RETURN
ABS(curr - avg3)

Endo Vitamin D Stability KPI =
VAR curr = [Endo Latest Vitamin D]
VAR avg3 = [Endo Vitamin D Rolling 3]
RETURN
ABS(curr - avg3)


-- =========================================================
-- COMBINED / CROSS-PROFILE
-- =========================================================

Combined Metabolic Risk Score =
AVERAGEX(
    {
        [Lipid AIP Score],
        [Lipid TG/HDL Score],
        [Lipid Remnant Score],
        [Endo HOMA-IR Score],
        [Endo QUICKI Score],
        [Endo HbA1c Score],
        [Endo Glucose Score]
    },
    [Value]
)

Combined Metabolic KPI =
VAR x = [Combined Metabolic Risk Score]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x <= 1.5, "Favorable",
    x <= 2.2, "Monitor",
    x <= 3.0, "Elevated combined metabolic risk",
    "High combined metabolic risk"
)

Combined Metabolic Color Hex =
VAR x = [Combined Metabolic Risk Score]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(x), BLANK(),
    x <= 1.5, "#2E7D32",
    x <= 2.2, "#F9A825",
    x <= 3.0, "#EF6C00",
    "#C62828"
)