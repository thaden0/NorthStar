import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting seed...');

  // Create Roles
  console.log('Creating roles...');
  const roles = [
    { name: 'Super Admin', description: 'Full system access including user management' },
    { name: 'Admin', description: 'Administrative access with logs viewing' },
    { name: 'Editor', description: 'Can edit portfolio content' },
    { name: 'User', description: 'Basic authenticated user' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

  // Create Super Admin User
  console.log('Creating super admin user...');
  const hashedPassword = await bcrypt.hash('Password1!', 12);
  
  const superAdmin = await prisma.user.upsert({
    where: { email: 'd333mon@gmail.com' },
    update: {},
    create: {
      email: 'd333mon@gmail.com',
      name: 'Leonard Waugh',
      hashedPassword,
      emailVerified: true,
    },
  });

  // Assign Super Admin role
  const superAdminRole = await prisma.role.findUnique({
    where: { name: 'Super Admin' },
  });

  if (superAdminRole) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: superAdmin.id,
          roleId: superAdminRole.id,
        },
      },
      update: {},
      create: {
        userId: superAdmin.id,
        roleId: superAdminRole.id,
      },
    });
  }

  // Create Portfolio Settings
  console.log('Creating portfolio settings...');
  await prisma.portfolioSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      heroTitle: 'Leonard Waugh',
      heroSubtitle: 'Full-Stack Developer, DevOps Engineer, Application Architect, Mobile Developer',
      aboutTitle: 'About me',
      aboutText: `Senior Web Developer with 25+ years building and optimizing web applications. Comfortable across the stack, with deep experience in modern JavaScript (Angular & React), large-scale migrations (AngularJS → Angular), and API-driven architectures. Led a team of 4 to modernize core apps, improving performance and maintainability.

Tooling I reach for includes TypeScript, Laravel/Node/Python, PostgreSQL/MySQL, Docker, and cloud platforms like AWS & Azure. I enjoy hard problems, clean architecture, and shipping durable software.`,
      name: 'Leonard Waugh',
      profile: 'Senior Full-Stack Developer',
      email: 'leonard.l.waugh@gmail.com',
      location: 'Tilbury, Ontario, Canada',
      linkedIn: 'https://www.linkedin.com/in/leonard-waugh-1bb098178',
      resumeSummary: 'Seasoned full-stack engineer specializing in Angular & React, legacy migrations, and scalable APIs. Proven leadership modernizing large front-ends and improving delivery with solid architecture and CI/CD.',
    },
  });

  // Create Skills
  console.log('Creating skills...');
  const skills = [
    { name: 'JavaScript', category: 'languages', icon: 'SiJavascript', order: 1 },
    { name: 'TypeScript', category: 'languages', icon: 'SiTypescript', order: 2 },
    { name: 'C#', category: 'languages', icon: 'SiCsharp', order: 3 },
    { name: 'C', category: 'languages', icon: 'SiC', order: 4 },
    { name: 'C++', category: 'languages', icon: 'SiCplusplus', order: 5 },
    { name: 'PHP', category: 'languages', icon: 'SiPhp', order: 6 },
    { name: 'Python', category: 'languages', icon: 'SiPython', order: 7 },
    { name: 'Java', category: 'languages', icon: 'SiJava', order: 8 },
    { name: 'Rust', category: 'languages', icon: 'SiRust', order: 9 },
    { name: 'x86 and WebAssembly', category: 'languages', icon: 'SiWebassembly', order: 10 },
    { name: 'Dart', category: 'languages', icon: 'SiDart', order: 11 },
    { name: 'Angular', category: 'frameworks', icon: 'SiAngular', order: 1 },
    { name: 'React', category: 'frameworks', icon: 'SiReact', order: 2 },
    { name: 'Vue', category: 'frameworks', icon: 'SiVuedotjs', order: 3 },
    { name: 'Django', category: 'frameworks', icon: 'SiDjango', order: 4 },
    { name: 'FastAPI', category: 'frameworks', icon: 'SiFastapi', order: 5 },
    { name: 'React Native', category: 'frameworks', icon: 'SiReact', order: 6 },
    { name: 'WordPress', category: 'frameworks', icon: 'SiWordpress', order: 7 },
    { name: 'Drupal', category: 'frameworks', icon: 'SiDrupal', order: 8 },
    { name: 'Spring / Spring Boot', category: 'frameworks', icon: 'SiSpring', order: 9 },
    { name: 'Unity', category: 'frameworks', icon: 'SiUnity', order: 10 },
    { name: 'Unreal Engine', category: 'frameworks', icon: 'SiUnrealengine', order: 11 },
    { name: 'Node.js', category: 'frameworks', icon: 'SiNodedotjs', order: 12 },
    { name: 'Docker', category: 'tools', icon: 'SiDocker', order: 1 },
    { name: 'Kubernetes', category: 'tools', icon: 'SiKubernetes', order: 2 },
    { name: 'Kafka', category: 'tools', icon: 'SiApachekafka', order: 3 },
    { name: 'LangFlow / Flowise', category: 'tools', icon: 'SiPython', order: 4 },
    { name: 'Ollama', category: 'tools', icon: 'SiPython', order: 5 },
    { name: 'LangChain', category: 'tools', icon: 'SiPython', order: 6 },
  ];

  for (const skill of skills) {
    await prisma.skill.create({ data: skill });
  }

  // Create Education
  console.log('Creating education...');
  await prisma.education.create({
    data: {
      degree: 'BSc, Computer Science',
      institution: 'University of Windsor',
      startYear: '2015',
      endYear: '2019',
      description: 'Computer Science with practical focus on software engineering and web technologies.',
      order: 1,
    },
  });

  // Create Experiences
  console.log('Creating experiences...');
  const experiences = [
    { title: 'Senior Full-Stack Developer', company: 'Surex Insurance', location: 'Cambridge, ON', startDate: 'Apr 2021', endDate: 'Mar 2025', highlights: ['Led migration of core AngularJS apps to modern Angular.', 'Defined software architecture for high-quality deliverables.', 'Integrated RESTful APIs (HATEOAS) for real-time insurance quoting.'], order: 1 },
    { title: 'Software Developer II', company: 'United Shore (UWM)', location: 'Pontiac, MI', startDate: 'Nov 2019', endDate: 'Apr 2021', highlights: ['Contributed within a SCRUM team to large-scale projects.', 'Mentored new hires on development practices and process.'], order: 2 },
    { title: 'Software Development Manager', company: 'Clearcom Media', location: 'Windsor, ON', startDate: '2013', endDate: '2015', highlights: ['Led a small team delivering web and mobile applications.', 'Worked across AWS and Azure environments.'], order: 3 },
    { title: 'Software Developer', company: 'Flexxia Corporation', location: 'Windsor, ON', startDate: '2012', endDate: '2013', highlights: ['Worked with a team delivering web applications and data tracking for our clients in the medical industry.', 'Developed custom modules for Drupal to meet the needs of our clients.'], order: 4 },
  ];

  for (const exp of experiences) {
    await prisma.experience.create({ data: exp });
  }

  // Create Services
  console.log('Creating services...');
  const services = [
    { title: 'Legacy → Modern Angular', description: 'Migrating AngularJS apps to Angular 2+, improving performance and maintainability.', icon: 'FiActivity', order: 1 },
    { title: 'React Front-Ends', description: 'Type-safe React SPAs with clean state management and API integration.', icon: 'FiBroadcast', order: 2 },
    { title: 'API Design & Integrations', description: 'RESTful services (incl. HATEOAS), auth flows, and robust testing.', icon: 'FiCode', order: 3 },
    { title: 'DevOps & CI/CD', description: 'Dockerized workflows, pipelines with GitLab CI/Jenkins, cloud deploys to AWS/Azure.', icon: 'FiServer', order: 4 },
    { title: 'CMS Engineering', description: 'Custom WordPress/Drupal builds, performance tuning, and integrations.', icon: 'FiLayout', order: 5 },
    { title: 'AI & RAG Prototypes', description: 'LangChain-based assistants, retrieval workflows, and knowledge tooling.', icon: 'FiCpu', order: 6 },
  ];

  for (const service of services) {
    await prisma.service.create({ data: service });
  }

  // Create Projects
  console.log('Creating projects...');
  const projects = [
    { title: 'ChatBot App', description: 'A custom LLM-powered ChatBot built with Python, FastAPI, Agno, and Ollama. Uses RAG pipelines over curated data about me, allowing visitors to explore my background and projects through natural conversation.', technologies: ['FastAPI', 'RAG', 'Python', 'Ollama'], liveUrl: '/chat', sourceUrl: 'https://github.com/thaden0/PortfolioChat', featured: true, order: 1 },
    { title: 'Feedback Frenzy', description: 'A full-featured SaaS feedback platform built in just one weekend with Laravel and React. It showcases end-to-end ticketing with user assignment, threaded comments, and real-time @mention notifications — a production-ready demo of modern SaaS speed and scalability.', technologies: ['Laravel', 'React', 'MySQL'], sourceUrl: 'https://github.com/thaden0/FeedbackFrenzy', featured: true, order: 2 },
    { title: 'DemoTheme', description: 'A lightweight WordPress block theme featuring custom CPT "Projects," REST endpoints, and dynamic navigation. Styled with a clean blue–orange palette, it highlights practical theme development and integration with modern WordPress features.', technologies: ['WordPress', 'REST', 'PHP'], sourceUrl: 'https://github.com/thaden0/wordpressDemoTheme', featured: true, order: 3 },
  ];

  for (const project of projects) {
    await prisma.project.create({ data: project });
  }

  // Create FAQs
  console.log('Creating FAQs...');
  const faqs = [
    { question: 'Do you handle legacy migrations?', answer: 'Yes — especially AngularJS to modern Angular, with incremental rollouts and feature parity.', order: 1 },
    { question: 'Can you integrate with existing APIs?', answer: "Absolutely. I've delivered HATEOAS-driven REST integrations for real-time experiences.", order: 2 },
    { question: 'What is your first published application?', answer: 'During the initial release of DOOM (1996), it shipped with a bug that prevented people from playing online with a modem. My first published application was the very first loader uploaded to the ID software bulletin board, which corrected for the bug and allowed players to play the game with their modems.', order: 3 },
    { question: 'What are your hobbies?', answer: 'I enjoy kayaking, building drones, and cooking French cuisine.', order: 4 },
    { question: 'How did you start coding?', answer: 'I started pair programming with my dad on a TRS-80 when I was just a kid. We did simple tricks and small games with ANSI BASIC.', order: 5 },
  ];

  for (const faq of faqs) {
    await prisma.fAQ.create({ data: faq });
  }

  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
    await prisma.$disconnect();
  });
