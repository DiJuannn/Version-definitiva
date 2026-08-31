/*
  Warnings:

  - You are about to drop the column `roll` on the `ClapLog` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ClapLog" DROP COLUMN "roll",
ADD COLUMN     "director" TEXT,
ADD COLUMN     "shotNumber" TEXT;
