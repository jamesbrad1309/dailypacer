import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ZodValidationPipe } from "#common/http/zod-validation.pipe";
import {
  type AddDependencyInput,
  type CreateColumnInput,
  type CreateListInput,
  type CreateTaskInput,
  type SearchTasksQuery,
  type UpdateColumnInput,
  type UpdateListInput,
  type UpdateTaskInput,
  addDependencySchema,
  createColumnSchema,
  createListSchema,
  createTaskSchema,
  deleteColumnQuerySchema,
  listTasksQuerySchema,
  searchTasksQuerySchema,
  todayQuerySchema,
  updateColumnSchema,
  updateListSchema,
  updateTaskSchema,
} from "#todos/dto/todo.dto";
import { TodosService } from "#todos/todos.service";

/** To-do lists and their tasks. Static routes come before `:id` ones. */
@Controller()
export class TodosController {
  constructor(private readonly todos: TodosService) {}

  @Get("todo-lists")
  lists() {
    return this.todos.lists();
  }

  /** `GET /todo-lists/suggest-prefix?name=Grocery list` → { prefix: "GRO" } */
  @Get("todo-lists/suggest-prefix")
  async suggestPrefix(@Query("name") name = "") {
    return { prefix: await this.todos.suggestPrefixFor(name) };
  }

  @Get("todo-lists/:id")
  list(@Param("id") id: string) {
    return this.todos.list(id);
  }

  @Get("todo-lists/:id/tasks")
  listTasks(
    @Param("id") id: string,
    @Query(new ZodValidationPipe(listTasksQuerySchema)) query: { doneLimit: number },
  ) {
    return this.todos.listTasks(id, query.doneLimit);
  }

  @Post("todo-lists")
  createList(@Body(new ZodValidationPipe(createListSchema)) input: CreateListInput) {
    return this.todos.createList(input);
  }

  @Patch("todo-lists/:id")
  updateList(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateListSchema)) input: UpdateListInput,
  ) {
    return this.todos.updateList(id, input);
  }

  @Delete("todo-lists/:id")
  deleteList(@Param("id") id: string) {
    return this.todos.deleteList(id);
  }

  /** Adds a board column at the right end. */
  @Post("todo-lists/:id/columns")
  createColumn(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(createColumnSchema)) input: CreateColumnInput,
  ) {
    return this.todos.createColumn(id, input);
  }

  @Patch("todo-columns/:id")
  updateColumn(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateColumnSchema)) input: UpdateColumnInput,
  ) {
    return this.todos.updateColumn(id, input);
  }

  /** `DELETE /todo-columns/:id?moveTo=<column id>`; see TodosService.deleteColumn. */
  @Delete("todo-columns/:id")
  deleteColumn(
    @Param("id") id: string,
    @Query(new ZodValidationPipe(deleteColumnQuerySchema)) query: { moveTo?: string },
  ) {
    return this.todos.deleteColumn(id, query.moveTo);
  }

  /** `GET /tasks/today?today=2026-10-02` → { today, earlier, dueSoon } */
  @Get("tasks/today")
  today(@Query(new ZodValidationPipe(todayQuerySchema)) query: { today: string }) {
    return this.todos.today(query.today);
  }

  /** Find tasks by title or key across every list; see TodosService.searchTasks. */
  @Get("tasks/search")
  searchTasks(@Query(new ZodValidationPipe(searchTasksQuerySchema)) query: SearchTasksQuery) {
    return this.todos.searchTasks(query.q, query.limit, query.exclude);
  }

  /** `GET /tasks/by-key/GRO-12` */
  @Get("tasks/by-key/:key")
  taskByKey(@Param("key") key: string) {
    return this.todos.taskByKey(key);
  }

  @Post("tasks")
  createTask(@Body(new ZodValidationPipe(createTaskSchema)) input: CreateTaskInput) {
    return this.todos.createTask(input);
  }

  @Patch("tasks/:id")
  updateTask(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateTaskSchema)) input: UpdateTaskInput,
  ) {
    return this.todos.updateTask(id, input);
  }

  @Get("tasks/:id")
  task(@Param("id") id: string) {
    return this.todos.task(id);
  }

  /** Make the task wait for another one (same or another list). */
  @Post("tasks/:id/dependencies")
  addDependency(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(addDependencySchema)) input: AddDependencyInput,
  ) {
    return this.todos.addDependency(id, input.dependsOnId);
  }

  @Delete("tasks/:id/dependencies/:dependsOnId")
  removeDependency(@Param("id") id: string, @Param("dependsOnId") dependsOnId: string) {
    return this.todos.removeDependency(id, dependsOnId);
  }

  @Delete("tasks/:id")
  deleteTask(@Param("id") id: string) {
    return this.todos.deleteTask(id);
  }
}
