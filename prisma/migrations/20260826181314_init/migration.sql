-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "kmSpesensatz" REAL NOT NULL,
    "jahresferientage" REAL NOT NULL,
    CONSTRAINT "CompanySettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "label" TEXT NOT NULL,
    "bezahlt" BOOLEAN NOT NULL,
    CONSTRAINT "Holiday_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MITARBEITER',
    CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JahresStammdaten" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "anstellungPct" REAL NOT NULL,
    "wochenstunden" REAL NOT NULL,
    "anzahlVorholtage" REAL NOT NULL DEFAULT 0,
    "stundenuebertragAltesJahr" REAL NOT NULL DEFAULT 0,
    "ferienuebertragAltesJahr" REAL NOT NULL DEFAULT 0,
    "arbeitsmonate" REAL NOT NULL DEFAULT 12,
    CONSTRAINT "JahresStammdaten_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "krank" REAL NOT NULL DEFAULT 0,
    "reisezeit" REAL NOT NULL DEFAULT 0,
    "cad" REAL NOT NULL DEFAULT 0,
    "ausbildung" REAL NOT NULL DEFAULT 0,
    "buero" REAL NOT NULL DEFAULT 0,
    "ferien" REAL NOT NULL DEFAULT 0,
    "spesenFr" REAL NOT NULL DEFAULT 0,
    "km" REAL NOT NULL DEFAULT 0,
    "sollOverride" REAL,
    "start1" INTEGER,
    "stop1" INTEGER,
    "start2" INTEGER,
    "stop2" INTEGER,
    "start3" INTEGER,
    "stop3" INTEGER,
    "start4" INTEGER,
    "stop4" INTEGER,
    CONSTRAINT "DailyEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dailyEntryId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "hours" REAL NOT NULL,
    CONSTRAINT "Booking_dailyEntryId_fkey" FOREIGN KEY ("dailyEntryId") REFERENCES "DailyEntry" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanySettings_companyId_year_key" ON "CompanySettings"("companyId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_companyId_date_key" ON "Holiday"("companyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "JahresStammdaten_userId_year_key" ON "JahresStammdaten"("userId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "DailyEntry_userId_date_key" ON "DailyEntry"("userId", "date");
