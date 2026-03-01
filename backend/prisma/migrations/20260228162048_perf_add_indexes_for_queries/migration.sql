-- CreateIndex
CREATE INDEX "Category_name_idx" ON "Category"("name");

-- CreateIndex
CREATE INDEX "CustomerQuestion_customerId_createdAt_idx" ON "CustomerQuestion"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerQuestion_status_createdAt_idx" ON "CustomerQuestion"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Question_createdAt_idx" ON "Question"("createdAt");

-- CreateIndex
CREATE INDEX "Question_viewCount_idx" ON "Question"("viewCount");

-- CreateIndex
CREATE INDEX "Question_visibility_createdAt_idx" ON "Question"("visibility", "createdAt");

-- CreateIndex
CREATE INDEX "Question_categoryId_createdAt_idx" ON "Question"("categoryId", "createdAt");

-- CreateIndex
CREATE INDEX "Tag_name_idx" ON "Tag"("name");
