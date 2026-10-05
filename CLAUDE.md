# CLAUDE.md

## Model usage

- Use the Opus model only for brainstorming stages of development: ideation, planning, writing specs, and creating stories.
- All code development (implementing, fixing, refactoring, reviewing, testing and committing code) must be done with Sonnet 5.
- Claude cannot switch its own model. Before starting code work while running on Opus, stop and ask the user to switch (`/model sonnet`). Likewise, suggest switching to Opus for brainstorming stages.
