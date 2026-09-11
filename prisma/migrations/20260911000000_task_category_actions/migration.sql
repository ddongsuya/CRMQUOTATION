-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'ETC';

-- CreateTable
CREATE TABLE "TaskAction" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskAction_taskId_at_idx" ON "TaskAction"("taskId", "at");

-- AddForeignKey
ALTER TABLE "TaskAction" ADD CONSTRAINT "TaskAction_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
