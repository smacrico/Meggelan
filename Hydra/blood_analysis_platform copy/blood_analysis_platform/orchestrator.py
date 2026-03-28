from __future__ import annotations

import argparse

from blood_analysis_platform.core.config import AppConfig
from blood_analysis_platform.core.logging_utils import get_logger
from blood_analysis_platform.profiles.lipidemic.pipeline import run_lipidemic_pipeline
from blood_analysis_platform.profiles.endocrinology.pipeline import run_endocrinology_pipeline


PROFILE_RUNNERS = {
    "lipidemic": run_lipidemic_pipeline,
    "endocrinology": run_endocrinology_pipeline,
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Blood Analysis Platform")
    parser.add_argument("--config", required=True, help="Path to config JSON")
    parser.add_argument("--profile", help="Single profile to run")
    parser.add_argument("--all", action="store_true", help="Run all enabled profiles")
    args = parser.parse_args()

    config = AppConfig.from_file(args.config)

    if args.profile:
        profile_names = [args.profile]
    elif args.all:
        profile_names = [
            name for name, cfg in config.profiles.items()
            if cfg.get("enabled", False)
        ]
    else:
        raise ValueError("Provide either --profile or --all")

    first_profile = profile_names[0]
    first_profile_cfg = config.profile(first_profile)
    logger = get_logger(
        app_name=config.app_name,
        log_dir=first_profile_cfg.get("log_dir", config.log_dir),
    )

    logger.info("Starting orchestrator for profiles: %s", ", ".join(profile_names))

    for profile_name in profile_names:
        runner = PROFILE_RUNNERS.get(profile_name)
        if runner is None:
            logger.warning("No runner registered for profile: %s", profile_name)
            continue

        profile_cfg = config.profile(profile_name)
        logger.info("Running profile: %s", profile_name)
        runner(config=config, logger=logger)

    logger.info("Orchestrator completed")
    
if __name__ == "__main__":
    main()
