from __future__ import annotations

import logging

from metrics import RunningMetricsService
from plots import RunningPlotter
from repository import RunningRepository


logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")


def main() -> None:
    db_path = "c:/smakrykoDBs/Apex.db"
    output_dir = "c:/temp/logsFitnessApp"

    repository = RunningRepository(db_path=db_path)
    metrics = RunningMetricsService(repository=repository, rest_hr=60, max_hr=190)
    plotter = RunningPlotter(output_dir=output_dir)

    df, weekly_trimp = metrics.load_training_log()
    logging.info("Loaded %s rows", len(df))

    if df.empty:
        logging.warning("No data found. Nothing to analyze.")
        return

    df = metrics.calculate_recovery_and_readiness(df)

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

    plotter.visualize_training_load(df, weekly_trimp)
    plotter.visualize_speed_metrics(df)
    plotter.visualize_hr_rs_deviation(df)
    plotter.advanced_visualizations(df)
    plotter.create_performance_dashboard(df)

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