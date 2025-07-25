import { Pool, PoolConfig } from "pg";
import {
  PostgresAdapter,
  PostgresFlavour,
  PostgresRepository,
} from "../../src";
let con: Pool;
const adapter = new PostgresAdapter(con);
import {
  Condition,
  index,
  Observer,
  OrderDirection,
  pk,
  Repository,
  table,
  uses,
} from "@decaf-ts/core";
import {
  min,
  minlength,
  model,
  ModelArg,
  required,
  type,
} from "@decaf-ts/decorator-validation";
import {
  ConflictError,
  NotFoundError,
  readonly,
} from "@decaf-ts/db-decorators";

import { PGBaseModel } from "./baseModel";

const admin = "alfred";
const admin_password = "password";
const user = "query_user";
const user_password = "password";
const dbHost = "localhost";

const config: PoolConfig = {
  user: admin,
  password: admin_password,
  database: "alfred",
  host: dbHost,
  port: 5432,
  ssl: false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  statement_timeout: 10000,
};

const dbName = "queries_db";

jest.setTimeout(50000);

describe("Queries", () => {
  @uses(PostgresFlavour)
  @table("tst_query_user")
  @model()
  class QueryUser extends PGBaseModel {
    @pk()
    id!: number;

    @required()
    @min(18)
    @index([OrderDirection.DSC, OrderDirection.ASC])
    age!: number;

    @required()
    @minlength(5)
    name!: string;

    @required()
    @readonly()
    @type([String.name])
    sex!: "M" | "F";

    constructor(arg?: ModelArg<QueryUser>) {
      super(arg);
    }
  }

  beforeAll(async () => {
    con = await PostgresAdapter.connect(config);
    expect(con).toBeDefined();

    try {
      await PostgresAdapter.deleteDatabase(con, dbName, user);
    } catch (e: unknown) {
      if (!(e instanceof NotFoundError)) throw e;
    }
    try {
      await PostgresAdapter.deleteUser(con, user, admin);
    } catch (e: unknown) {
      if (!(e instanceof NotFoundError)) throw e;
    }
    try {
      await PostgresAdapter.createDatabase(con, dbName);
      await con.end();
      con = await PostgresAdapter.connect(
        Object.assign({}, config, {
          database: dbName,
        })
      );
      await PostgresAdapter.createUser(con, dbName, user, user_password);
      await PostgresAdapter.createNotifyFunction(con, user);
      await con.end();
    } catch (e: unknown) {
      if (!(e instanceof ConflictError)) throw e;
    }

    con = await PostgresAdapter.connect(
      Object.assign({}, config, {
        user: user,
        password: user_password,
        database: dbName,
      })
    );

    adapter["_native" as keyof typeof PostgresAdapter] = con;

    try {
      await PostgresAdapter.createTable(con, QueryUser);
    } catch (e: unknown) {
      if (!(e instanceof ConflictError)) throw e;
    }
  });

  let observer: Observer;
  let mock: any;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.resetAllMocks();
    mock = jest.fn();
    observer = new (class implements Observer {
      refresh(...args: any[]): Promise<void> {
        return mock(...args);
      }
    })();
    // repo.observe(observer);
  });
  //
  // afterEach(() => {
  //   repo.unObserve(observer);
  // });

  afterAll(async () => {
    await con.end();
    con = await PostgresAdapter.connect(config);
    await PostgresAdapter.deleteDatabase(con, dbName, user);
    await PostgresAdapter.deleteUser(con, user, admin);
    await con.end();
  });

  let created: QueryUser[];

  it("Creates in bulk", async () => {
    const repo: PostgresRepository<QueryUser> = Repository.forModel<
      QueryUser,
      PostgresRepository<QueryUser>
    >(QueryUser);
    const models = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(
      (i) =>
        new QueryUser({
          age: Math.floor(18 + (i - 1) / 3),
          name: "user_name_" + i,
          sex: i % 2 === 0 ? "M" : "F",
        })
    );
    created = await repo.createAll(models);
    expect(created).toBeDefined();
    expect(Array.isArray(created)).toEqual(true);
    expect(created.every((el) => el instanceof QueryUser)).toEqual(true);
    expect(created.every((el) => !el.hasErrors())).toEqual(true);
  });

  it("Performs simple queries - full object", async () => {
    const repo: PostgresRepository<QueryUser> = Repository.forModel(QueryUser);
    const selected = await repo.select().execute();
    expect(
      created.every((c) => c.equals(selected.find((s: any) => (s.id = c.id))))
    );
  });

  it("Performs simple queries - attributes only", async () => {
    const repo: PostgresRepository<QueryUser> = Repository.forModel<
      QueryUser,
      PostgresRepository<QueryUser>
    >(QueryUser);
    const selected = await repo.select(["age", "sex"]).execute();
    expect(selected).toEqual(
      expect.arrayContaining(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        [...new Array(created.length)].map((e) =>
          expect.objectContaining({
            age: expect.any(Number),
            sex: expect.stringMatching(/^M|F$/g),
          })
        )
      )
    );
  });

  it("Performs conditional queries - full object", async () => {
    const repo: PostgresRepository<QueryUser> = Repository.forModel<
      QueryUser,
      PostgresRepository<QueryUser>
    >(QueryUser);
    const condition = Condition.attribute<QueryUser>("age").eq(20);
    const selected = await repo.select().where(condition).execute();
    expect(selected.length).toEqual(created.filter((c) => c.age === 20).length);
  });

  it("Performs conditional queries - selected attributes", async () => {
    const repo: PostgresRepository<QueryUser> = Repository.forModel<
      QueryUser,
      PostgresRepository<QueryUser>
    >(QueryUser);
    const condition = Condition.attribute<QueryUser>("age").eq(20);
    const selected = await repo
      .select(["age", "sex"])
      .where(condition)
      .execute();
    expect(selected.length).toEqual(created.filter((c) => c.age === 20).length);
    expect(selected).toEqual(
      expect.arrayContaining(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        [...new Array(created.length)].map((e: any) =>
          expect.objectContaining({
            age: expect.any(Number),
            sex: expect.stringMatching(/^M|F$/g),
          })
        )
      )
    );
  });

  it("Performs AND conditional queries - full object", async () => {
    const repo: PostgresRepository<QueryUser> = Repository.forModel<
      QueryUser,
      PostgresRepository<QueryUser>
    >(QueryUser);
    const condition = Condition.attribute<QueryUser>("age")
      .eq(20)
      .and(Condition.attribute<QueryUser>("sex").eq("M"));
    const selected = await repo.select().where(condition).execute();
    expect(selected.length).toEqual(
      created.filter((c) => c.age === 20 && c.sex === "M").length
    );
  });

  it("Performs OR conditional queries - full object", async () => {
    const repo = Repository.forModel<QueryUser, PostgresRepository<QueryUser>>(
      QueryUser
    );
    const condition = Condition.attribute<QueryUser>("age")
      .eq(20)
      .or(Condition.attribute<QueryUser>("age").eq(19));
    const selected = await repo.select().where(condition).execute();
    expect(selected.length).toEqual(
      created.filter((c) => c.age === 20 || c.age === 19).length
    );
  });

  it("Sorts attribute", async () => {
    const repo: PostgresRepository<QueryUser> = Repository.forModel(QueryUser);
    const sorted = await repo
      .select()
      .orderBy(["age", OrderDirection.DSC])
      .execute();
    expect(sorted).toBeDefined();
    expect(sorted.length).toEqual(created.length);

    expect(sorted[0]).toEqual(
      expect.objectContaining(created[created.length - 1])
    );
  });
});
