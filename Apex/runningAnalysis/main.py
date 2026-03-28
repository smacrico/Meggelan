from __future__ import annotations

import logging
from datetime import datetime

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
        logging.warning("Database empty. Adding sample session.")
        repository.add_session(
            date=datetime.now().strftime("%Y-%m-%d"),
            running_economy=73,
            vo2max=19.0,
            distance=5,
            time=27,  # minutes
            heart_rate=150,
            cardiacdrift=0.0,
        )
        df, weekly_trimp = metrics.load_training_log()

    repository.create_metrics_breakdown_table()
    repository.save_training_log(df)

    plotter.visualize_trends(df)
    plotter.visualize_training_load(df, weekly_trimp)

    df = metrics.calculate_recovery_and_readiness(df)
    plotter.visualize_recovery_and_readiness(df)

    training_score = metrics.calculate_training_score(df)
    if training_score:
        print("\\nTraining Score Analysis:")
        print(f"Overall Training Score: {training_score['overall_score']:.2f}")

        values_to_insert = metrics.build_metrics_breakdown_row(df, training_score)
        repository.insert_metrics_breakdown(values_to_insert)

    monthly_avg = metrics.calculate_monthly_metrics_averages(df)
    if monthly_avg is not None and not monthly_avg.empty:
        repository.create_monthly_summaries_table()
        monthly_sessions = metrics.get_monthly_session_counts(df)
        repository.upsert_monthly_summaries(monthly_avg, monthly_sessions)

    session_scores = metrics.calculate_session_scores(df)
    plotter.visualize_score_impact_over_time(
        df,
        session_scores,
        extra_scores={
            "Recovery Score": "recovery_score",
            "Readiness Score": "readiness_score",
        },
    )

    speed_analysis = metrics.analyze_speed_metrics(df)
    hr_rs_analysis = metrics.analyze_hr_rs_deviation(df)

    if speed_analysis:
        print("\\nSpeed Analysis:")
        for key, value in speed_analysis.items():
            print(f"{key}: {value}")

    if hr_rs_analysis:
        print("\\nHR-RS Analysis:")
        for key, value in hr_rs_analysis.items():
            print(f"{key}: {value}")

    plotter.visualize_speed_metrics(df)
    plotter.visualize_hr_rs_deviation(df)

    logging.info("Done.")


if __name__ == "__main__":
    main()
