import { Pool, PoolConfig } from "pg";
import { PostgresAdapter } from "../../src";
let con: Pool;
const adapter = new PostgresAdapter(con);
import {
  NoPopulateManyModel,
  NoPopulateOnceModel,
  testAddress,
  TestAddressModel,
  testCountry,
  TestCountryModel,
  TestDummyCountry,
  TestDummyPhone,
  testPhone,
  TestPhoneModel,
  testUser,
  TestUserModel,
} from "./models";
import { Model } from "@decaf-ts/decorator-validation";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { Condition, Observer } from "@decaf-ts/core";
import { sequenceNameForModel } from "@decaf-ts/core";
import { Sequence } from "@decaf-ts/core";
import { PostgresRepository } from "../../src/PostgresRepository";

const admin = "postgres";
const admin_password = "password";
const user = "complex_user";
const user_password = "password";
const dbHost = "localhost";

const config: PoolConfig = {
  user: admin,
  password: admin_password,
  database: "postgres",
  host: dbHost,
  port: 5432,
  ssl: false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  statement_timeout: 10000,
};

const dbName = "complex_db";

Model.setBuilder(Model.fromModel);

jest.setTimeout(500000);

describe.skip(`Complex Database`, function () {
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
    await PostgresAdapter.createTable(con, TestDummyPhone);
    await PostgresAdapter.createTable(con, TestDummyCountry);
    await PostgresAdapter.createTable(con, TestPhoneModel);

    await PostgresAdapter.createTable(con, TestCountryModel);
    await PostgresAdapter.createTable(con, TestAddressModel);

    await PostgresAdapter.createTable(con, TestUserModel);

    await PostgresAdapter.createTable(con, NoPopulateOnceModel);
    await PostgresAdapter.createTable(con, NoPopulateManyModel);
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

  let userRepository: PostgresRepository<TestUserModel>;
  let testDummyCountryModelRepository: PostgresRepository<TestDummyCountry>;
  let testPhoneModelRepository: PostgresRepository<TestPhoneModel>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let testDummyPhoneModelRepository: PostgresRepository<TestDummyPhone>;
  let testAddressModelRepository: PostgresRepository<TestAddressModel>;
  let testCountryModelRepository: PostgresRepository<TestCountryModel>;
  let noPopulateOnceModelRepository: PostgresRepository<NoPopulateOnceModel>;
  let noPopulateManyModelRepository: PostgresRepository<NoPopulateManyModel>;

  let model: any;

  beforeAll(async () => {
    userRepository = new PostgresRepository(adapter, TestUserModel);
    testPhoneModelRepository = new PostgresRepository(adapter, TestPhoneModel);
    testAddressModelRepository = new PostgresRepository(
      adapter,
      TestAddressModel
    );
    testCountryModelRepository = new PostgresRepository(
      adapter,
      TestCountryModel
    );
    testDummyCountryModelRepository = new PostgresRepository(
      adapter,
      TestDummyCountry
    );
    testDummyPhoneModelRepository = new PostgresRepository(
      adapter,
      TestDummyPhone
    );
    noPopulateOnceModelRepository = new PostgresRepository(
      adapter,
      NoPopulateOnceModel
    );
    noPopulateManyModelRepository = new PostgresRepository(
      adapter,
      NoPopulateManyModel
    );

    model = {
      name: "test country",
      countryCode: "tst",
      locale: "ts_TS",
    };
  });

  describe("basic test", () => {
    let cached: TestCountryModel;

    it("creates a new record", async () => {
      const record = new TestCountryModel(model);
      const created = await testCountryModelRepository.create(record);
      expect(created).toBeDefined();
      expect(
        created.equals(
          record,
          "createdOn",
          "updatedOn",
          "createdBy",
          "updatedBy",
          "id"
        )
      ).toEqual(true);
      expect(created.id).toEqual(1);
      cached = created;
    });

    it("reads a record", async () => {
      const read = await testCountryModelRepository.read(1);
      expect(read).toBeDefined();
      expect(read.equals(cached)).toEqual(true);
    });

    it("updates a record", async () => {
      const toUpdate = new TestCountryModel(
        Object.assign({}, cached, {
          name: "other test name",
        })
      );
      const updated = await testCountryModelRepository.update(toUpdate);
      const read = await testCountryModelRepository.read(1);
      expect(read).toBeDefined();
      expect(read.name).toEqual("other test name");
      expect(read.equals(updated)).toEqual(true);
      cached = read;
    });

    it("finds a record", async () => {
      const condition =
        Condition.attribute<TestCountryModel>("name").eq("other test name");
      const results: TestCountryModel[] = await testCountryModelRepository
        .select()
        .where(condition)
        .execute();
      expect(results).toBeDefined();
      expect(results.length).toEqual(1);
      expect(cached.equals(results[0])).toEqual(true);
    });

    it("deletes a record", async () => {
      const deleted = await testCountryModelRepository.delete(1);
      await expect(testCountryModelRepository.read(1)).rejects.toBeInstanceOf(
        NotFoundError
      );
      expect(deleted.equals(cached)).toEqual(true);
    });
  });

  describe("Complex relations Test", () => {
    let sequenceModel: Sequence;
    let sequenceCountry: Sequence;

    describe("One to one relations", () => {
      let created: TestAddressModel;
      let updated: TestAddressModel;
      it("Ensure no population when populate is disabled in a one-to-one relation", async () => {
        const sequenceModel = await adapter.Sequence({
          name: sequenceNameForModel(NoPopulateOnceModel, "pk"),
          type: "Number",
          startWith: 0,
          incrementBy: 1,
          cycle: false,
        });

        const sequenceCountry = await adapter.Sequence({
          name: sequenceNameForModel(TestDummyCountry, "pk"),
          type: "Number",
          startWith: 0,
          incrementBy: 1,
          cycle: false,
        });

        const noPopulateOnceCurVal = (await sequenceModel.current()) as number;

        const countryCurVal = (await sequenceCountry.current()) as number;

        const country = {
          name: "test country",
          countryCode: "tst",
          locale: "ts_TS",
        };

        const address = new NoPopulateOnceModel({ country });
        const created = await noPopulateOnceModelRepository.create(address);
        expect(created.country).toEqual(noPopulateOnceCurVal + 1);

        const read = await noPopulateOnceModelRepository.read(`${created.id}`);
        expect(read.country).toEqual(countryCurVal + 1);

        created.country = new TestDummyCountry({
          name: "foo",
          countryCode: "foo",
          locale: "fo_FO",
        });
        const updated = await noPopulateOnceModelRepository.update(created);
        expect(updated.country).toEqual(countryCurVal + 2);

        const deleted = await noPopulateOnceModelRepository.delete(created.id);
        expect(deleted.country).toEqual(countryCurVal + 2);

        const c = testDummyCountryModelRepository.read(countryCurVal + 1);
        expect(c).toBeDefined();
      });

      it("Creates a one to one relation", async () => {
        sequenceModel = await adapter.Sequence({
          name: Sequence.pk(TestAddressModel),
          type: "Number",
          startWith: 0,
          incrementBy: 1,
          cycle: false,
        });

        sequenceCountry = await adapter.Sequence({
          name: Sequence.pk(TestCountryModel),
          type: "Number",
          startWith: 0,
          incrementBy: 1,
          cycle: false,
        });

        const address = new TestAddressModel({
          street: "test street",
          doorNumber: "test door",
          apartmentNumber: "test number",
          areaCode: "test area code",
          city: "test city",
          country: model,
        });
        created = (await testAddressModelRepository.create(
          address
        )) as TestAddressModel;

        testAddress(created);

        const read = (await testAddressModelRepository.read(
          created.id
        )) as TestAddressModel;
        testAddress(read);
        expect(created.equals(read)).toEqual(true);
        expect(created.country.equals(read.country)).toEqual(true);

        const read2 = (await testCountryModelRepository.read(
          created.country.id
        )) as TestCountryModel;
        testCountry(read2);
        expect(read2.equals(created.country)).toEqual(true);
      });

      it("Updates a one to one relation", async () => {
        const address = new TestAddressModel(
          Object.assign({}, created, {
            city: "test city2",
            country: new TestCountryModel(
              Object.assign({}, created.country, {
                name: "other name",
              })
            ),
          })
        );
        updated = await testAddressModelRepository.update(address);
        testAddress(updated);

        const read = await testAddressModelRepository.read(updated.id);
        testAddress(read);
        expect(updated.equals(read)).toEqual(true);
        expect(updated.country.equals(read.country)).toEqual(true);

        const read2 = (await testCountryModelRepository.read(
          created.country.id
        )) as TestCountryModel;
        testCountry(read2);
        expect(read2.equals(updated.country)).toEqual(true);
      });

      it("Deletes a one to one relation", async () => {
        const deleted = await testAddressModelRepository.delete(updated.id);
        testAddress(deleted);
        await expect(
          testAddressModelRepository.read(updated.id)
        ).rejects.toBeInstanceOf(NotFoundError);
        await expect(
          testCountryModelRepository.read(updated.country.id)
        ).rejects.toBeInstanceOf(NotFoundError);
      });

      it("Creates another to check sequences", async () => {
        const current = (await sequenceModel.current()) as number;

        const currentCountry = (await sequenceCountry.current()) as number;

        const address = new TestAddressModel({
          street: "test street",
          doorNumber: "test door",
          apartmentNumber: "test number",
          areaCode: "test area code",
          city: "test city",
          country: model,
        });
        created = (await testAddressModelRepository.create(
          address
        )) as TestAddressModel;

        expect(created.id).toEqual(current + 1);
        expect(created.country.id).toEqual(currentCountry + 1);
      });
    });

    describe("One to many relations", () => {
      const user = {
        name: "testuser",
        email: "test@test.com",
        age: 25,
        address: {
          street: "test street",
          doorNumber: "test door",
          apartmentNumber: "test number",
          areaCode: "test area code",
          city: "test city",
          country: {
            name: "test country",
            countryCode: "tst",
            locale: "ts_TS",
          },
        },
        phones: [
          {
            areaCode: "351",
            number: "000-0000000",
          },
          {
            areaCode: "351",
            number: "000-0000001",
          },
        ],
      };

      let created: TestUserModel;
      let updated: TestUserModel;

      it("Ensure no population when populate is disabled in a one-to-many relation", async () => {
        const phones = [
          {
            areaCode: "351",
            number: "000-0000000",
          },
          {
            areaCode: "351",
            number: "000-0000001",
          },
        ];

        const sequencePhone = await adapter.Sequence({
          name: Sequence.pk(TestDummyPhone),
          type: "Number",
          startWith: 0,
          incrementBy: 1,
          cycle: false,
        });

        const currPhone = (await sequencePhone.current()) as number;

        const m = new NoPopulateManyModel({
          name: "Robert",
          phones: phones,
        });
        const created = await noPopulateManyModelRepository.create(m);
        expect(created.phones).toEqual([currPhone + 1, currPhone + 2]);

        const read = await noPopulateManyModelRepository.read(created.id);
        expect(read.phones).toEqual([currPhone + 1, currPhone + 2]);

        read.phones = [
          new TestDummyPhone({
            areaCode: "352",
            phoneNumber: "000-0000002",
          }),
          new TestDummyPhone({
            areaCode: "51",
            phoneNumber: "000-0000000",
          }),
        ];
        const updated = await noPopulateManyModelRepository.update(read);
        expect(updated.phones).toEqual([currPhone + 3, currPhone + 4]);

        const deleted = await noPopulateManyModelRepository.delete(created.id);
        expect(deleted.phones).toEqual([currPhone + 3, currPhone + 4]);
      });

      it("Creates a one to many relation", async () => {
        created = await userRepository.create(new TestUserModel(user));

        testUser(created);

        const read = await userRepository.read(created.id);
        testUser(read);

        const { address, phones } = read;
        expect(created.equals(read)).toEqual(true);
        expect(created.address.equals(address)).toEqual(true);

        const read2 = await testAddressModelRepository.read(created.address.id);
        testAddress(read2);
        expect(read2.equals(created.address)).toEqual(true);

        const read3 = await testCountryModelRepository.read(address.country.id);
        testCountry(read3);
        expect(read3.equals(address.country)).toEqual(true);
        phones.forEach((p: any) => {
          testPhone(p);
        });
      });

      it("Updates a one to many relation", async () => {
        // created = await userManager.create(new TestUserModel(user));
        const toUpdate = new TestUserModel(
          Object.assign({}, created, {
            name: "new name",
            address: Object.assign({}, created.address, {
              city: "new city",
              country: Object.assign({}, created.address?.country, {
                name: "new country",
              }),
            }),
            phones: [
              Object.assign({}, (created.phones as any[])[0], {
                areaCode: "352",
              }),
              Object.assign({}, (created.phones as any[])[1], {
                areaCode: "352",
              }),
            ],
          })
        );
        updated = await userRepository.update(toUpdate);
        testUser(updated);

        const read = await userRepository.read(updated.id);
        testUser(read);
        expect(read.name).toEqual("new name");

        const { address, phones } = read;
        expect(updated.equals(read)).toEqual(true);
        expect(updated.address.equals(address)).toEqual(true);
        const read2 = await testAddressModelRepository.read(updated.address.id);
        testAddress(read2);
        expect(read2.city).toEqual("new city");
        expect(read2.equals(updated.address)).toEqual(true);

        const read3 = await testCountryModelRepository.read(address.country.id);
        testCountry(read3);
        expect(read3.equals(address.country)).toEqual(true);
        expect(read3.name).toEqual("new country");

        phones.forEach((p: any) => {
          testPhone(p);
          expect(p.areaCode).toEqual("352");
        });
      });

      it("Deletes a one to many relation", async () => {
        const deleted = await userRepository.delete(updated.id);
        testUser(deleted);
        await expect(
          testAddressModelRepository.read(updated.address.id)
        ).rejects.toBeInstanceOf(NotFoundError);
        await expect(
          testCountryModelRepository.read(updated.address.country.id)
        ).rejects.toBeInstanceOf(NotFoundError);
        await expect(
          testPhoneModelRepository.read((updated.phones as any)[0].id)
        ).rejects.toBeInstanceOf(NotFoundError);
        await expect(
          testPhoneModelRepository.read((updated.phones as any)[1].id)
        ).rejects.toBeInstanceOf(NotFoundError);
      });
    });

    describe("Validate a key populate", () => {
      it("In a one-to-one relation", async () => {
        const country = await testCountryModelRepository.create(
          new TestCountryModel({
            name: "Portugal",
            countryCode: "pt",
            locale: "pt_PT",
          })
        );

        const address = new TestAddressModel({
          street: "5th Avenue",
          doorNumber: "517",
          apartmentNumber: "NA",
          areaCode: "646e",
          city: "New York",
          country: country.id,
        });
        const created = await testAddressModelRepository.create(address);

        expect(created.country).toEqual(expect.objectContaining(country));

        testAddress(created);

        const readAddress = await testAddressModelRepository.read(created.id);
        testAddress(readAddress);
        expect(created.equals(readAddress)).toEqual(true);
        expect(created.country.equals(readAddress.country)).toEqual(true);

        const readCountry = (await testCountryModelRepository.read(
          created.country.id
        )) as TestCountryModel;
        testCountry(readCountry);
        expect(readCountry.equals(created.country)).toEqual(true);
      });

      it("In a one-to-many relation", async () => {
        const country = await testCountryModelRepository.create(
          new TestCountryModel({
            name: "Italy",
            countryCode: "it",
            locale: "it_IT",
          })
        );

        const phone1 = await testPhoneModelRepository.create(
          new TestPhoneModel({
            areaCode: "51",
            number: "510 899000010",
          })
        );

        const phone2 = await testPhoneModelRepository.create(
          new TestPhoneModel({
            areaCode: "59",
            number: "059 901000900",
          })
        );

        const phoneIds = [phone1.id, phone2.id];

        const user = new TestUserModel({
          name: "Ronald",
          email: "ronald@test.com",
          age: 36,
          address: {
            street: "New avenue",
            doorNumber: "414e4",
            apartmentNumber: "404",
            areaCode: "51",
            city: "New Desert City",
            country: country.id,
          },
          phones: phoneIds,
        });

        const created: TestUserModel = await userRepository.create(user);

        expect(created.address.country).toEqual(
          expect.objectContaining(country)
        );

        expect((created.phones || [])[0]).toEqual(
          expect.objectContaining(phone1)
        );
        expect((created.phones || [])[1]).toEqual(
          expect.objectContaining(phone2)
        );

        testUser(created);

        const read = await userRepository.read(created.id);
        testUser(read);

        const { address, phones } = read;
        expect(created.equals(read)).toEqual(true);
        expect(created.address?.equals(address)).toEqual(true);

        const read2 = await testAddressModelRepository.read(created.address.id);
        testAddress(read2);
        expect(read2.equals(created.address)).toEqual(true);

        const read3 = await testCountryModelRepository.read(address.country.id);
        testCountry(read3);
        expect(read3.equals(address?.country)).toEqual(true);
        phones.forEach((p: any) => {
          testPhone(p);
        });
      });

      it("Populate should fail when all elements do not match the same type", async () => {
        const country = await testCountryModelRepository.create(
          new TestCountryModel({
            name: "Spain",
            countryCode: "es",
            locale: "es_ES",
          })
        );

        const phone1 = await testPhoneModelRepository.create(
          new TestPhoneModel({
            areaCode: "49",
            number: "490 899000010",
          })
        );

        const phoneIds = [
          phone1.id,
          {
            areaCode: "63",
            number: "063 96310009",
          },
        ];

        const user = new TestUserModel({
          name: "Ronald",
          email: "ronald@test.com",
          age: 36,
          address: {
            street: "New avenue",
            doorNumber: "414e4",
            apartmentNumber: "404",
            areaCode: "51",
            city: "New Desert City",
            country: country.id,
          },
          phones: phoneIds,
        });

        let created: any = undefined;
        try {
          created = await userRepository.create(user);
        } catch (e: any) {
          expect(e?.message).toContain(
            "Invalid operation. All elements of property phones must match the same type."
          );
        }
        expect(created).toBeUndefined();
      });
    });
  });
});
