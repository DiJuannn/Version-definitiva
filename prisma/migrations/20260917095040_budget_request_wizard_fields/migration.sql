/*
  Warnings:

  - Added the required column `duration` to the `BudgetRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hasScript` to the `BudgetRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BudgetRequest" ADD COLUMN     "duration" TEXT NOT NULL,
ADD COLUMN     "hasScript" TEXT NOT NULL;
