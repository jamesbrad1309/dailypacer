import { Module } from "@nestjs/common";
import { TodosController } from "#todos/todos.controller";
import { TodosService } from "#todos/todos.service";

@Module({
  controllers: [TodosController],
  providers: [TodosService],
})
export class TodosModule {}
