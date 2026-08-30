-- CreateIndex
CREATE INDEX "Actor_projectId_idx" ON "Actor"("projectId");

-- CreateIndex
CREATE INDEX "Actor_personId_idx" ON "Actor"("personId");

-- CreateIndex
CREATE INDEX "BreakdownElement_projectId_idx" ON "BreakdownElement"("projectId");

-- CreateIndex
CREATE INDEX "BudgetCategory_projectId_idx" ON "BudgetCategory"("projectId");

-- CreateIndex
CREATE INDEX "BudgetItem_categoryId_idx" ON "BudgetItem"("categoryId");

-- CreateIndex
CREATE INDEX "BudgetItem_actorId_idx" ON "BudgetItem"("actorId");

-- CreateIndex
CREATE INDEX "BudgetItem_locationId_idx" ON "BudgetItem"("locationId");

-- CreateIndex
CREATE INDEX "BudgetItem_crewMemberId_idx" ON "BudgetItem"("crewMemberId");

-- CreateIndex
CREATE INDEX "BudgetItem_breakdownElementId_idx" ON "BudgetItem"("breakdownElementId");

-- CreateIndex
CREATE INDEX "CalendarEvent_organizationId_idx" ON "CalendarEvent"("organizationId");

-- CreateIndex
CREATE INDEX "CalendarEvent_projectId_idx" ON "CalendarEvent"("projectId");

-- CreateIndex
CREATE INDEX "Character_projectId_idx" ON "Character"("projectId");

-- CreateIndex
CREATE INDEX "Character_actorId_idx" ON "Character"("actorId");

-- CreateIndex
CREATE INDEX "ChecklistTemplate_organizationId_idx" ON "ChecklistTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "ChecklistTemplateItem_templateId_idx" ON "ChecklistTemplateItem"("templateId");

-- CreateIndex
CREATE INDEX "ContinuityCheck_projectId_idx" ON "ContinuityCheck"("projectId");

-- CreateIndex
CREATE INDEX "ContinuityIssue_checkId_idx" ON "ContinuityIssue"("checkId");

-- CreateIndex
CREATE INDEX "CrewMember_projectId_idx" ON "CrewMember"("projectId");

-- CreateIndex
CREATE INDEX "CrewMember_personId_idx" ON "CrewMember"("personId");

-- CreateIndex
CREATE INDEX "Document_projectId_idx" ON "Document"("projectId");

-- CreateIndex
CREATE INDEX "Document_actorId_idx" ON "Document"("actorId");

-- CreateIndex
CREATE INDEX "Document_locationId_idx" ON "Document"("locationId");

-- CreateIndex
CREATE INDEX "Document_personId_idx" ON "Document"("personId");

-- CreateIndex
CREATE INDEX "InventoryItem_organizationId_idx" ON "InventoryItem"("organizationId");

-- CreateIndex
CREATE INDEX "Invite_organizationId_idx" ON "Invite"("organizationId");

-- CreateIndex
CREATE INDEX "ItemReservation_shootingDayId_idx" ON "ItemReservation"("shootingDayId");

-- CreateIndex
CREATE INDEX "Location_organizationId_idx" ON "Location"("organizationId");

-- CreateIndex
CREATE INDEX "Person_organizationId_idx" ON "Person"("organizationId");

-- CreateIndex
CREATE INDEX "PortfolioItem_siteContentId_idx" ON "PortfolioItem"("siteContentId");

-- CreateIndex
CREATE INDEX "Project_organizationId_idx" ON "Project"("organizationId");

-- CreateIndex
CREATE INDEX "Scene_projectId_idx" ON "Scene"("projectId");

-- CreateIndex
CREATE INDEX "Scene_locationId_idx" ON "Scene"("locationId");

-- CreateIndex
CREATE INDEX "SceneBreakdownElement_breakdownElementId_idx" ON "SceneBreakdownElement"("breakdownElementId");

-- CreateIndex
CREATE INDEX "SceneCharacter_characterId_idx" ON "SceneCharacter"("characterId");

-- CreateIndex
CREATE INDEX "SceneCrewMember_crewMemberId_idx" ON "SceneCrewMember"("crewMemberId");

-- CreateIndex
CREATE INDEX "ScriptAnalysis_projectId_idx" ON "ScriptAnalysis"("projectId");

-- CreateIndex
CREATE INDEX "ScriptAnalysis_scriptFileId_idx" ON "ScriptAnalysis"("scriptFileId");

-- CreateIndex
CREATE INDEX "ScriptFile_projectId_idx" ON "ScriptFile"("projectId");

-- CreateIndex
CREATE INDEX "ServiceItem_siteContentId_idx" ON "ServiceItem"("siteContentId");

-- CreateIndex
CREATE INDEX "ShootingDay_projectId_idx" ON "ShootingDay"("projectId");

-- CreateIndex
CREATE INDEX "ShootingDayScene_sceneId_idx" ON "ShootingDayScene"("sceneId");

-- CreateIndex
CREATE INDEX "Shot_sceneId_idx" ON "Shot"("sceneId");

-- CreateIndex
CREATE INDEX "StoryboardFrame_shotId_idx" ON "StoryboardFrame"("shotId");

-- CreateIndex
CREATE INDEX "Task_organizationId_idx" ON "Task"("organizationId");

-- CreateIndex
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");

-- CreateIndex
CREATE INDEX "Task_shootingDayId_idx" ON "Task"("shootingDayId");

-- CreateIndex
CREATE INDEX "TaskComment_taskId_idx" ON "TaskComment"("taskId");

-- CreateIndex
CREATE INDEX "User_organizationId_idx" ON "User"("organizationId");

-- CreateIndex
CREATE INDEX "Vehicle_organizationId_idx" ON "Vehicle"("organizationId");

-- CreateIndex
CREATE INDEX "VehicleReservation_shootingDayId_idx" ON "VehicleReservation"("shootingDayId");
