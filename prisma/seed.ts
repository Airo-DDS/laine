import { PrismaClient, Role } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Clean the database first (optional, depends on desired seeding behavior)
  console.log('Clearing existing data...')
  await prisma.task.deleteMany({}) // Clear dependent models first
  await prisma.roleResponsibility.deleteMany({})
  await prisma.appointment.deleteMany({})
  await prisma.patient.deleteMany({})
  await prisma.knowledgeTopic.deleteMany({})
  await prisma.user.deleteMany({})
  await prisma.organization.deleteMany({})

  console.log('Seeding the database...')

  // Create a default Organization
  const defaultOrg = await prisma.organization.create({
    data: {
      name: 'Aero Dental Practice'
    },
  })
  console.log(`Created default organization: ${defaultOrg.name} (ID: ${defaultOrg.id})`)

  // Create users and link to the organization
  const admin = await prisma.user.create({
    data: {
      email: 'admin@airodental.com',
      name: 'Admin User',
      role: 'ADMIN',
      organizationId: defaultOrg.id, // Link to org
    },
  })

  const dentist = await prisma.user.create({
    data: {
      email: 'dentist@airodental.com',
      name: 'Dr. Smith',
      role: 'DENTIST',
      organizationId: defaultOrg.id, // Link to org
    },
  })

  const receptionist = await prisma.user.create({
    data: {
      email: 'receptionist@airodental.com',
      name: 'Jane Doe',
      role: 'RECEPTIONIST',
      organizationId: defaultOrg.id, // Link to org
    },
  })

  const officeManager = await prisma.user.create({
      data: {
          email: 'manager@airodental.com',
          name: 'Sarah Manager',
          role: 'OFFICE_MANAGER',
          organizationId: defaultOrg.id,
      },
  })

  const billingSpecialist = await prisma.user.create({
      data: {
          email: 'billing@airodental.com',
          name: 'Mike Billington',
          role: 'BILLING_SPECIALIST',
          organizationId: defaultOrg.id,
      },
  })

  console.log('Created users:', { admin, dentist, receptionist, officeManager, billingSpecialist })

  // Seed Role Responsibilities
  await prisma.roleResponsibility.createMany({
      data: [
          { role: Role.RECEPTIONIST, description: "Handles appointment booking, confirmation calls, and new patient registration checks.", organizationId: defaultOrg.id },
          { role: Role.DENTIST, description: "Performs dental procedures, consultations, and reviews patient charts.", organizationId: defaultOrg.id },
          { role: Role.OFFICE_MANAGER, description: "Oversees daily operations, manages staff schedules, and handles patient complaints.", organizationId: defaultOrg.id },
          { role: Role.BILLING_SPECIALIST, description: "Verifies insurance information, processes patient billing, and follows up on outstanding claims.", organizationId: defaultOrg.id },
          { role: Role.ADMIN, description: "Manages system settings, user accounts, and overall application configuration.", organizationId: defaultOrg.id },
      ]
  })
  console.log('Created Role Responsibilities')

  // Create patients and link to the organization and dentist
  const patient1 = await prisma.patient.create({
    data: {
      firstName: 'John',
      lastName: 'Test',
      email: 'john.test@example.com',
      phoneNumber: '555-111-2222',
      dateOfBirth: new Date('1985-05-15'),
      userId: dentist.id,
      organizationId: defaultOrg.id, // Link to org
    },
  })

  const patient2 = await prisma.patient.create({
    data: {
      firstName: 'Alice',
      lastName: 'Example',
      email: 'alice.example@example.com',
      phoneNumber: '555-333-4444',
      dateOfBirth: new Date('1990-10-20'),
      userId: dentist.id,
      organizationId: defaultOrg.id, // Link to org
    },
  })

  console.log('Created patients:', { patient1, patient2 })

  // Create appointments and link to organization and patient
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(10, 0, 0, 0) // Set specific time

  const nextWeek = new Date(today)
  nextWeek.setDate(nextWeek.getDate() + 7)
  nextWeek.setHours(14, 30, 0, 0) // Set specific time

  const appointment1 = await prisma.appointment.create({
    data: {
      date: tomorrow,
      reason: 'Regular checkup',
      patientType: 'EXISTING',
      status: 'CONFIRMED',
      notes: 'Patient has sensitivity in lower right molar',
      patientId: patient1.id,
      organizationId: defaultOrg.id, // Link to org
    },
  })

  const appointment2 = await prisma.appointment.create({
    data: {
      date: nextWeek,
      reason: 'Teeth cleaning',
      patientType: 'EXISTING',
      status: 'SCHEDULED',
      notes: 'Follow-up appointment after filling',
      patientId: patient2.id,
      organizationId: defaultOrg.id, // Link to org
    },
  })

  // Add more appointments
  const dayAfterTomorrow = new Date(today)
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2)
  dayAfterTomorrow.setHours(9, 0, 0, 0)

  await prisma.appointment.create({
    data: {
      date: dayAfterTomorrow,
      reason: 'New patient consultation',
      patientType: 'NEW',
      status: 'CONFIRMED',
      notes: 'First visit, comprehensive exam needed',
      patientId: patient1.id,
      organizationId: defaultOrg.id, // Link to org
    },
  })

  console.log('Created appointments')

  // Add a sample KnowledgeTopic linked to the org
  await prisma.knowledgeTopic.create({
      data: {
          topicName: 'Office Hours & Location',
          content: 'Our office hours are Monday to Friday, 9 AM to 5 PM. We are located at 123 Dental St, Smileville.',
          assistantId: 'demo-assistant-id', // Replace with a real ID if needed for testing
          organizationId: defaultOrg.id,
      }
  })
  console.log('Created sample Knowledge Topic')

  console.log('Database seeding completed.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('Error during seeding:', e)
    await prisma.$disconnect()
    process.exit(1)
  }) 