SPECIFY PROCESS:
- run the constitution command with the user input argument
    ```
        .codex/prompts/constitution.md replace $ARGUMENTS with .arguments/constitution-arg-1.md
    ```
- run the specify command
    ```
        .codex/prompts/specify.md replace $ARGUMENTS with .arguments/specify-arg-1.md
    ```
- run the clarify command
    ```
        .codex/prompts/clarify.md
    ```
- run the plan command
    ```
        .codex/prompts/plan.md replace $ARGUMENTS with .arguments/plan-tech-stack.md
    ```
- run the tasks command
    ```
        .codex/prompts/tasks.md
    ```
- run the implement command
    ```
        .codex/prompts/implement.md
    ```