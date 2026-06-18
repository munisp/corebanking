import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1747498800000 implements MigrationInterface {
    name = 'Migration1747498800000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add dfsp_id if the column is missing (tenant table may have been created without it)
        await queryRunner.query(`ALTER TABLE "administration"."tenant" ADD COLUMN IF NOT EXISTS "dfsp_id" character varying`);
        // Backfill existing rows using name as dfsp_id
        await queryRunner.query(`UPDATE "administration"."tenant" SET "dfsp_id" = "name" WHERE "dfsp_id" IS NULL`);
        // Now enforce NOT NULL
        await queryRunner.query(`ALTER TABLE "administration"."tenant" ALTER COLUMN "dfsp_id" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "administration"."tenant" DROP COLUMN IF EXISTS "dfsp_id"`);
    }
}
