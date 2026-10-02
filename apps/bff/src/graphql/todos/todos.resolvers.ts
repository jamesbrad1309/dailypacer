import type { GraphQLContext } from "#graphql/context";

const enc = encodeURIComponent;

/**
 * To-do lists and tasks. The API sends keys ready-made and dates as
 * "YYYY-MM-DD"; list counts (openCount, doneCount) come with the list.
 * Plain pass-through, so no field resolvers.
 */
export default {
  Query: {
    todoLists: (_: unknown, __: unknown, ctx: GraphQLContext) => ctx.api.get("/todo-lists"),
    suggestListPrefix: async (_: unknown, args: { name: string }, ctx: GraphQLContext) =>
      (await ctx.api.get<{ prefix: string }>(`/todo-lists/suggest-prefix?name=${enc(args.name)}`))
        .prefix,
    listBoard: (_: unknown, args: { listId: string; doneLimit: number }, ctx: GraphQLContext) =>
      ctx.api.get(`/todo-lists/${enc(args.listId)}/tasks?doneLimit=${args.doneLimit}`),
    todayTasks: (_: unknown, args: { today: string }, ctx: GraphQLContext) =>
      ctx.api.get(`/tasks/today?today=${enc(args.today)}`),
    taskByKey: (_: unknown, args: { key: string }, ctx: GraphQLContext) =>
      ctx.api.get(`/tasks/by-key/${enc(args.key)}`),
  },
  Mutation: {
    createTodoList: (_: unknown, args: { input: unknown }, ctx: GraphQLContext) =>
      ctx.api.post("/todo-lists", args.input),
    updateTodoList: (_: unknown, args: { id: string; input: unknown }, ctx: GraphQLContext) =>
      ctx.api.patch(`/todo-lists/${enc(args.id)}`, args.input),
    deleteTodoList: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      await ctx.api.delete(`/todo-lists/${enc(args.id)}`);
      return args.id;
    },
    createTask: (_: unknown, args: { input: unknown }, ctx: GraphQLContext) =>
      ctx.api.post("/tasks", args.input),
    updateTask: (_: unknown, args: { id: string; input: unknown }, ctx: GraphQLContext) =>
      ctx.api.patch(`/tasks/${enc(args.id)}`, args.input),
    deleteTask: async (_: unknown, args: { id: string }, ctx: GraphQLContext) => {
      await ctx.api.delete(`/tasks/${enc(args.id)}`);
      return args.id;
    },
  },
};
