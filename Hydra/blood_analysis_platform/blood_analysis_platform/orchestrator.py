
from __future__ import annotations

import argparse
from typing import Callable

from blood_analysis_platform.core.config import AppConfig
from blood_analysis_platform.core.logging_utils import build_logger
from blood_analysis_platform.profiles.lipidemic.pipeline import run_lipidemic_pipeline


PROFILE_RUNNERS: dict[str, Callable] = {
    "lipidemic": run_lipidemic_pipeline,
}


def main() -> None:
    parser = argparse.ArgumentParser(description="Blood Analysis Platform orchestrator")
    parser.add_argument("--config", required=True, help="Path to config JSON")
    parser.add_argument("--profile", help="Single profile to run")
    parser.add_argument("--all", action="store_true", help="Run all enabled profiles")
    args = parser.parse_args()

    config = AppConfig.from_file(args.config)
    logger = build_logger(config.log_dir)

    if args.all:
        profiles = list(PROFILE_RUNNERS.keys())
    elif args.profile:
        profiles = [args.profile]
    else:
        raise ValueError("Provide either --profile <name> or --all")

    logger.info("Starting orchestrator for profiles: %s", ", ".join(profiles))

    for profile_name in profiles:
        runner = PROFILE_RUNNERS.get(profile_name)
        if runner is None:
            raise ValueError(f"Unsupported profile: {profile_name}")
        logger.info("Running profile: %s", profile_name)
        runner(config=config, logger=logger)
        logger.info("Completed profile: %s", profile_name)

    logger.info("Orchestrator finished successfully")


if __name__ == "__main__":
    main()
