from __future__ import annotations

import logging

from metrics_enhanced import RunningMetricsService
from plots_enhanced import RunningPlotter
from repository_enhanced import RunningRepository


logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")


def main() -> None:
    db_path = "c:/smakrykoDBs/Apex.db"
    output_dir = "c:/temp/logsFitnessApp"

    repository = RunningRepository(db_path=db_path)
    metrics = RunningMetricsService(repository=repository, rest_hr=60, max_hr=190)
    plotter = RunningPlotter(output_dir=output_dir)

    # metrics_enhanced.load_training_log() now calculates:
    # - all original derived metrics
    # - true calendar 7-day rolling metrics
    # - 7-day acute / 28-day chronic load and ACWR
    # - monotony and strain
    # - efficiency factor, performance index, aerobic decoupling proxy
    # - recovery_score and readiness_score
    df, weekly_trimp = metrics.load_training_log()
    logging.info("Loaded %s rows", len(df))

    if df.empty:
        logging.warning("No data found. Nothing to analyze.")
        return

    # Safe to call again, but metrics_enhanced already adds these in load_training_log().
    # Keeping this here makes the script robust if load_training_log() changes later.
    df = metrics.calculate_recovery_and_readiness(df)

    # Add fatigue, overtraining, risk level, latest ACWR/monotony/strain summary.
    df, anomaly_summary = metrics.detect_anomalies(df, weekly_trimp)

    # Persist the fully enhanced dataframe after all derived metrics and risk flags exist.
    repository.save_training_log(df)

    monthly_avg = metrics.calculate_monthly_metrics_averages(df)
    if monthly_avg is not None and not monthly_avg.empty:
        repository.create_monthly_summaries_table()
        monthly_sessions = metrics.get_monthly_session_counts(df)
        repository.upsert_monthly_summaries(monthly_avg, monthly_sessions)

    training_score = metrics.calculate_training_score(df)
    if training_score:
        repository.create_metrics_breakdown_table()
        values_to_insert = metrics.build_metrics_breakdown_row(df, training_score)
        repository.insert_metrics_breakdown(values_to_insert)

        print("\nTraining Score Analysis:")
        print(f"Overall Training Score: {training_score['overall_score']:.2f}")

        print("\nMetric Breakdown:")
        for metric, details in training_score["metric_breakdown"].items():
            print(f"{metric}: {details}")

        print("\nPerformance Trends:")
        for trend, value in training_score["performance_trends"].items():
            print(f"{trend}: {value:.4f}")

    speed_analysis = metrics.analyze_speed_metrics(df)
    hr_rs_analysis = metrics.analyze_hr_rs_deviation(df)

    if speed_analysis:
        print("\nSpeed Analysis:")
        for key, value in speed_analysis.items():
            print(f"{key}: {value}")

    if hr_rs_analysis:
        print("\nHR-RS Analysis:")
        for key, value in hr_rs_analysis.items():
            print(f"{key}: {value}")

    if anomaly_summary:
        print("\nFatigue / Overtraining Risk:")
        for key, value in anomaly_summary.items():
            print(f"{key}: {value}")

    enhanced_columns = [
        "acute_load_7d",
        "chronic_load_28d",
        "acwr_7_28",
        "weekly_monotony",
        "weekly_strain",
        "efficiency_factor",
        "performance_index",
        "aerobic_decoupling_pct",
        "recovery_score",
        "readiness_score",
        "fatigue_flag",
        "overtraining_flag",
        "risk_level",
    ]
    available_enhanced_columns = [col for col in enhanced_columns if col in df.columns]
    logging.info("Enhanced derived metrics available: %s", ", ".join(available_enhanced_columns))

    plotter.visualize_trends(df)
    plotter.visualize_training_load(df, weekly_trimp)
    plotter.visualize_recovery_and_readiness(df)
    plotter.visualize_score_impact_over_time(
        df,
        metrics.calculate_session_scores(df),
        extra_scores={
            "Recovery Score": "recovery_score",
            "Readiness Score": "readiness_score",
        },
    )
    plotter.visualize_speed_metrics(df)
    plotter.visualize_hr_rs_deviation(df)
    plotter.advanced_visualizations(df)
    plotter.create_performance_dashboard(df)

    logging.info("Analysis complete. PNG exports written to %s", output_dir)


if __name__ == "__main__":
    main()
