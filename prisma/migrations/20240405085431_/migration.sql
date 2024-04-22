-- CreateTable
CREATE TABLE "promoCode" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(255),
    "description" VARCHAR(255),
    "type" VARCHAR(255),
    "value" INTEGER,
    "expireOn" TIMESTAMPTZ,
    "startedFrom" TIMESTAMPTZ,
    "totalCount" INTEGER,
    "consumedCount" INTEGER,
    "maxAmount" DECIMAL(65,30),

    CONSTRAINT "promoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundQueue" (
    "id" TEXT NOT NULL,
    "tavaBookingId" VARCHAR(255),
    "isCompleted" BOOLEAN DEFAULT false,
    "refundAmount" VARCHAR(255),
    "source" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(3) DEFAULT '2023-12-26 08:44:51.498 +00:00',
    "updatedAt" TIMESTAMPTZ(3) DEFAULT '2023-12-26 08:45:31.119 +00:00',
    "remarks" JSONB DEFAULT '{}',
    "bookingId" VARCHAR(255),
    "paymentId" VARCHAR(255),
    "division" VARCHAR(255) NOT NULL DEFAULT 'FLIGHT',
    "currency" VARCHAR(255),

    CONSTRAINT "RefundQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travelers" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255),
    "firstname" VARCHAR(255),
    "middlename" VARCHAR(255),
    "lastname" VARCHAR(255),
    "dateofbirth" VARCHAR(255),
    "passportnumber" VARCHAR(255),
    "issuancedate" VARCHAR(255),
    "expirydate" VARCHAR(255),
    "gender" VARCHAR(255) DEFAULT 'MALE',
    "primary" BOOLEAN DEFAULT false,
    "countrycode" VARCHAR(255),
    "countryname" VARCHAR(255),
    "nationality" VARCHAR(255),
    "phonenumber" VARCHAR(255),
    "userId" VARCHAR(255),
    "email" VARCHAR(255),

    CONSTRAINT "travelers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reissuance" (
    "id" TEXT NOT NULL,
    "pnr" VARCHAR(255),
    "providerBookingId" VARCHAR(255),
    "tavaBookingId" VARCHAR(255),
    "status" VARCHAR(255),
    "paymentStatus" VARCHAR(255),
    "paymentSessionId" VARCHAR(255),
    "paymentId" VARCHAR(255),
    "orderType" VARCHAR(255),
    "ticketingJSON" JSONB DEFAULT '{}',
    "bookingId" VARCHAR(255),
    "userEmail" VARCHAR(255),
    "provider" VARCHAR(255),

    CONSTRAINT "Reissuance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duplicateBooking" (
    "id" TEXT NOT NULL,
    "duplicateTavaId" VARCHAR(255),
    "tavaBookingId" VARCHAR(255),
    "correspondingPNR" VARCHAR(255),

    CONSTRAINT "duplicateBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queries" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255),
    "email" VARCHAR(255),
    "phone" VARCHAR(255),
    "message" VARCHAR(1024),
    "createdAt" TIMESTAMPTZ(3) DEFAULT '2024-01-05 12:01:10.299 +00:00',
    "updatedAt" TIMESTAMPTZ(3) DEFAULT '2024-01-05 12:01:18.391 +00:00',
    "status" VARCHAR(255) DEFAULT 'OPEN',

    CONSTRAINT "queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commissions" (
    "id" TEXT NOT NULL,
    "serviceType" VARCHAR(255) NOT NULL,
    "carrierCode" VARCHAR(50) NOT NULL,
    "providerName" VARCHAR(255) NOT NULL,
    "commission" DECIMAL(65,30) NOT NULL,
    "commissionType" VARCHAR(100) NOT NULL,
    "source" VARCHAR(200) NOT NULL,
    "destination" VARCHAR(200) NOT NULL,
    "effectiveStartDate" TIMESTAMPTZ(3) NOT NULL DEFAULT '2023-08-25 10:26:25 +00:00',
    "effectiveEndDate" TIMESTAMPTZ(3) NOT NULL DEFAULT '2023-08-25 10:26:25 +00:00',
    "notes" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(3) DEFAULT '2023-08-25 10:26:25 +00:00',
    "updatedAt" TIMESTAMPTZ(3),

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "tavaBookingId" VARCHAR(255),
    "providerBookingId" VARCHAR(255),
    "pnr" VARCHAR(255),
    "status" VARCHAR(255) DEFAULT 'PENDING',
    "provider" VARCHAR(255) DEFAULT 'AMADEUS',
    "userEmail" VARCHAR(255),
    "paymentSessionId" VARCHAR(255),
    "paymentStatus" VARCHAR(255) DEFAULT 'PENDING',
    "paymentId" VARCHAR(255),
    "orderType" VARCHAR(255) DEFAULT 'INSTANT',
    "bookingJSON" JSONB DEFAULT '{}',
    "ticketingJSON" JSONB DEFAULT '{}',
    "ticketingStatus" VARCHAR(255) DEFAULT 'PENDING',
    "cancelationStatus" VARCHAR(255) DEFAULT 'NOTAPPLIED',
    "createdAt" TIMESTAMPTZ(0) DEFAULT '2023-08-25 10:26:25 +00:00',
    "updatedAt" TIMESTAMPTZ(0) DEFAULT '2023-08-24 10:26:57.309 +00:00',
    "corelationId" VARCHAR(255),
    "travelerEmail" VARCHAR(255),

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Users" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255),
    "email" VARCHAR(255),
    "password" VARCHAR(255),
    "accessToken" VARCHAR(1024),
    "refreshToken" VARCHAR(1024),
    "phone" VARCHAR(255),
    "dateOfBirth" VARCHAR(255),
    "profilePic" VARCHAR(1024),
    "profileName" VARCHAR(1024),
    "role" VARCHAR(255) DEFAULT 'USER',
    "provider" VARCHAR(255),
    "verificationCode" VARCHAR(255),
    "codeTimestamp" TIMESTAMPTZ(3),

    CONSTRAINT "Users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "specialServiceRuleTable" (
    "id" TEXT NOT NULL,
    "enable" BOOLEAN DEFAULT false,
    "currency" VARCHAR(255),
    "origin" VARCHAR(255),
    "destination" VARCHAR(255),
    "carriercode" VARCHAR(255),
    "offermeals" BOOLEAN DEFAULT false,
    "offerseats" BOOLEAN DEFAULT false,
    "Offerfrequentflyermiles" BOOLEAN DEFAULT false,
    "offerpricewithincludedbaggage" BOOLEAN DEFAULT false,
    "indicators" VARCHAR(255),
    "corporatecodes" VARCHAR(255),
    "request" VARCHAR(255),

    CONSTRAINT "specialServiceRuleTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "enable" BOOLEAN DEFAULT false,
    "regionality" VARCHAR(255) DEFAULT 'DOMESTIC',
    "provider" VARCHAR(255),
    "validTill" TIMESTAMPTZ(3) DEFAULT '2023-09-10 18:32:05.470 +00:00',

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketingInfo" (
    "id" TEXT NOT NULL,
    "bookingid" VARCHAR(255),
    "ticketnbr" VARCHAR(255),
    "status" VARCHAR(255) DEFAULT 'PENDING',
    "reference" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(3) DEFAULT '2023-08-25 10:26:25 +00:00',
    "updatedAt" TIMESTAMPTZ(3) DEFAULT '2023-08-24 10:26:57.309 +00:00',

    CONSTRAINT "TicketingInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentSession" (
    "id" TEXT NOT NULL,
    "currency" VARCHAR(255),
    "amount" INTEGER,
    "session_status" VARCHAR(255),
    "session_id" VARCHAR(255),
    "metadata" JSONB DEFAULT '{}',
    "createdAt" VARCHAR(255),
    "expireAt" VARCHAR(255),
    "paymentGateway" VARCHAR(255),
    "paymentId" VARCHAR(255),
    "refundAmount" VARCHAR(255),
    "division" VARCHAR(255) NOT NULL DEFAULT 'FLIGHT',
    "useremail" VARCHAR(255),
    "paymentPageUrl" VARCHAR(255),
    "paymentresjson" JSONB DEFAULT '{}',
    "refundresjson" VARCHAR(1024) DEFAULT '{}',

    CONSTRAINT "PaymentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "serviceProviderStatus" (
    "id" TEXT NOT NULL,
    "provider" VARCHAR(255),
    "status" BOOLEAN DEFAULT false,

    CONSTRAINT "serviceProviderStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotelCity" (
    "id" TEXT NOT NULL,
    "destination" VARCHAR(255),
    "stateProvince" VARCHAR(255),
    "stateProvinceCode" VARCHAR(255),
    "country" VARCHAR(255),
    "countryCode" VARCHAR(255),

    CONSTRAINT "hotelCity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotelBooking" (
    "id" VARCHAR(255) NOT NULL,
    "tavaBookingId" VARCHAR(255) NOT NULL,
    "bookingStatus" VARCHAR(255) DEFAULT 'AWAITING PAYMENT',
    "bookingId" VARCHAR(255),
    "confirmationNo" VARCHAR(255),
    "bookingRefNo" VARCHAR(255),
    "invoiceNo" VARCHAR(255),
    "provider" VARCHAR(255) DEFAULT 'TBO',
    "paymentStatus" VARCHAR(255) DEFAULT 'PENDING',
    "paymentId" VARCHAR(255),
    "paymentSessionId" VARCHAR(255),
    "bookingResJson" JSONB DEFAULT '{}',
    "bookingReqJson" JSONB DEFAULT '{}',
    "blockRoomResJson" JSONB DEFAULT '{}',
    "blockRoomReqJson" JSONB DEFAULT '{}',
    "userEmail" VARCHAR(255),
    "guestEmail" VARCHAR(255),
    "cancelationStatus" VARCHAR(255) DEFAULT 'NOT APPLIED',
    "corelationId" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(0) DEFAULT '2023-08-25 10:26:25 +00:00',
    "updatedAt" TIMESTAMPTZ(0) DEFAULT '2023-08-24 10:26:57.309 +00:00',
    "voucherExpiryDate" VARCHAR(255),
    "isVoucheredBooking" BOOLEAN DEFAULT false,

    CONSTRAINT "hotelBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unsettledBooking" (
    "id" VARCHAR(255) NOT NULL,
    "provider" VARCHAR(255) NOT NULL,
    "division" VARCHAR(255) NOT NULL DEFAULT 'FLIGHT',
    "isCompleted" BOOLEAN DEFAULT false,
    "bookingId" VARCHAR(255) NOT NULL,
    "tavaBookingId" VARCHAR(255) NOT NULL,
    "pnr" VARCHAR(255),
    "retryCount" INTEGER NOT NULL,

    CONSTRAINT "unsettledBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logging" (
    "id" TEXT NOT NULL,
    "corelationId" VARCHAR(255),
    "date" VARCHAR(255),
    "serviceType" VARCHAR(255),
    "logType" VARCHAR(255),
    "log" JSONB DEFAULT '{}',
    "url" VARCHAR(255),
    "bookingId" VARCHAR(255),

    CONSTRAINT "logging_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "travelers" ADD CONSTRAINT "travelers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reissuance" ADD CONSTRAINT "Reissuance_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
