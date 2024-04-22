const { PrismaClient, Prisma: PrismaInstance } = require('@prisma/client')

const prisma = new PrismaClient()

module.exports = {
	prisma,
	PrismaInstance,
}
