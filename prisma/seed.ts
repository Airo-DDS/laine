import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Clean the database
  await prisma.appointment.deleteMany({})
  await prisma.patient.deleteMany({})
  await prisma.user.deleteMany({})

  console.log('Seeding the database...')
  
  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email: 'admin@airodental.com',
      name: 'Admin User',
      role: 'ADMIN',
    },
  })
  
  // Create a dentist
  const dentist = await prisma.user.create({
    data: {
      email: 'dentist@airodental.com',
      name: 'Dr. Smith',
      role: 'DENTIST',
    },
  })
  
  // Create a receptionist
  const receptionist = await prisma.user.create({
    data: {
      email: 'receptionist@airodental.com',
      name: 'Jane Doe',
      role: 'RECEPTIONIST',
    },
  })
  
  console.log('Created users:', { admin, dentist, receptionist })
  
  // Create patients
  const patient1 = await prisma.patient.create({
    data: {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phoneNumber: '555-123-4567',
      dateOfBirth: new Date('1985-05-15'),
      userId: dentist.id,
    },
  })
  
  const patient2 = await prisma.patient.create({
    data: {
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice.smith@example.com',
      phoneNumber: '555-987-6543',
      dateOfBirth: new Date('1990-10-20'),
      userId: dentist.id,
    },
  })
  
  console.log('Created patients:', { patient1, patient2 })
  
  // Create appointments
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  const nextWeek = new Date(today)
  nextWeek.setDate(nextWeek.getDate() + 7)
  
  const appointment1 = await prisma.appointment.create({
    data: {
      date: tomorrow,
      status: 'CONFIRMED',
      notes: 'Regular checkup',
      patientId: patient1.id,
    },
  })
  
  const appointment2 = await prisma.appointment.create({
    data: {
      date: nextWeek,
      status: 'SCHEDULED',
      notes: 'Follow-up appointment',
      patientId: patient2.id,
    },
  })
  
  console.log('Created appointments:', { appointment1, appointment2 })
  
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