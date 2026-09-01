-- CreateEnum
CREATE TYPE "OrganizationPlan" AS ENUM ('FREE', 'PRO');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "lemonSqueezyCustomerId" TEXT,
ADD COLUMN     "lemonSqueezySubscriptionId" TEXT,
ADD COLUMN     "plan" "OrganizationPlan" NOT NULL DEFAULT 'FREE';
