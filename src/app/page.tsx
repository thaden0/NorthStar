import Link from 'next/link';
import { Header } from '@/components/layout';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { 
  SiJavascript, 
  SiTypescript, 
  SiCplusplus,
  SiPhp,
  SiPython,
  SiRust,
  SiDart,
  SiAngular,
  SiReact,
  SiVuedotjs,
  SiDjango,
  SiFastapi,
  SiWordpress,
  SiDrupal,
  SiSpring,
  SiUnity,
  SiUnrealengine,
  SiNodedotjs,
  SiDocker,
  SiKubernetes,
  SiApachekafka
} from 'react-icons/si';
import { FiExternalLink, FiGithub, FiMail, FiMapPin, FiLinkedin, FiChevronDown, FiCode } from 'react-icons/fi';
import styles from './page.module.css';

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  SiJavascript,
  SiTypescript,
  SiCplusplus,
  SiPhp,
  SiPython,
  SiRust,
  SiDart,
  SiAngular,
  SiReact,
  SiVuedotjs,
  SiDjango,
  SiFastapi,
  SiWordpress,
  SiDrupal,
  SiSpring,
  SiUnity,
  SiUnrealengine,
  SiNodedotjs,
  SiDocker,
  SiKubernetes,
  SiApachekafka,
  FiCode,
};

async function getPortfolioData() {
  const [settings, skills, education, experiences, services, projects, faqs] = await Promise.all([
    db.portfolioSettings.findFirst(),
    db.skill.findMany({ orderBy: { order: 'asc' } }),
    db.education.findMany({ orderBy: { order: 'asc' } }),
    db.experience.findMany({ orderBy: { order: 'asc' } }),
    db.service.findMany({ orderBy: { order: 'asc' } }),
    db.project.findMany({ where: { featured: true }, orderBy: { order: 'asc' } }),
    db.fAQ.findMany({ orderBy: { order: 'asc' } }),
  ]);

  return { settings, skills, education, experiences, services, projects, faqs };
}

export default async function HomePage() {
  const session = await getSession();
  const { settings, skills, education, experiences, services, projects, faqs } = await getPortfolioData();

  const languageSkills = skills.filter(s => s.category === 'languages');
  const frameworkSkills = skills.filter(s => s.category === 'frameworks');
  const toolSkills = skills.filter(s => s.category === 'tools');

  return (
    <>
      <Header user={session?.user} />
      
      <main className={styles.main}>
        {/* Hero Section */}
        <section className={styles.hero}>
          <div className={styles.heroGlow} />
          <div className={styles.heroContent}>
            <h1 className={styles.heroTitle}>
              I am <span className={styles.gradient}>{settings?.heroTitle || 'Leonard Waugh'}</span>
            </h1>
            <p className={styles.heroSubtitle}>
              {settings?.heroSubtitle || 'Full-Stack Developer, DevOps Engineer, Application Architect'}
            </p>
            <div className={styles.heroActions}>
              <Link href="#about" className={styles.btnPrimary}>
                Learn More
              </Link>
              <Link href="#portfolio" className={styles.btnSecondary}>
                View Projects
              </Link>
            </div>
            <div className={styles.scrollIndicator}>
              <FiChevronDown className={styles.scrollIcon} />
            </div>
          </div>
        </section>

        {/* About Section */}
        <section id="about" className={styles.section}>
          <div className={styles.container}>
            <h2 className={styles.sectionTitle}>About Me</h2>
            <p className={styles.sectionSubtitle}>
              {settings?.resumeSummary}
            </p>

            <div className={styles.aboutGrid}>
              <div className={styles.aboutInfo}>
                <div className={styles.glassCard}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Name</span>
                    <span className={styles.infoValue}>{settings?.name}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Profile</span>
                    <span className={styles.infoValue}>{settings?.profile}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <FiMail className={styles.infoIcon} />
                    <span className={styles.infoValue}>{settings?.email}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <FiMapPin className={styles.infoIcon} />
                    <span className={styles.infoValue}>{settings?.location}</span>
                  </div>
                  {settings?.linkedIn && (
                    <div className={styles.infoItem}>
                      <FiLinkedin className={styles.infoIcon} />
                      <a href={settings.linkedIn} target="_blank" rel="noopener noreferrer" className={styles.infoLink}>
                        LinkedIn Profile
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.aboutText}>
                <div className={styles.glassCard}>
                  <h3>About me</h3>
                  <div className={styles.aboutContent}>
                    {settings?.aboutText.split('\n\n').map((paragraph, i) => (
                      <p key={i}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Skills */}
            <div className={styles.skillsSection}>
              <h3 className={styles.skillsTitle}>Skills</h3>
              
              <div className={styles.skillCategory}>
                <h4 className={styles.skillCategoryTitle}>Languages</h4>
                <div className={styles.skillGrid}>
                  {languageSkills.map((skill) => {
                    const Icon = iconMap[skill.icon || ''];
                    return (
                      <div key={skill.id} className={styles.skillBadge}>
                        {Icon && <Icon className={styles.skillIcon} />}
                        <span>{skill.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={styles.skillCategory}>
                <h4 className={styles.skillCategoryTitle}>Frameworks</h4>
                <div className={styles.skillGrid}>
                  {frameworkSkills.map((skill) => {
                    const Icon = iconMap[skill.icon || ''];
                    return (
                      <div key={skill.id} className={styles.skillBadge}>
                        {Icon && <Icon className={styles.skillIcon} />}
                        <span>{skill.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className={styles.skillCategory}>
                <h4 className={styles.skillCategoryTitle}>Tools</h4>
                <div className={styles.skillGrid}>
                  {toolSkills.map((skill) => {
                    const Icon = iconMap[skill.icon || ''];
                    return (
                      <div key={skill.id} className={styles.skillBadge}>
                        {Icon && <Icon className={styles.skillIcon} />}
                        <span>{skill.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Resume Section */}
        <section id="resume" className={styles.section}>
          <div className={styles.container}>
            <h2 className={styles.sectionTitle}>Resume</h2>
            <p className={styles.sectionSubtitle}>Selected roles, education, and core technologies.</p>

            <div className={styles.resumeGrid}>
              <div>
                <h3 className={styles.resumeCategory}>Education</h3>
                <div className={styles.timeline}>
                  {education.map((edu) => (
                    <div key={edu.id} className={styles.timelineItem}>
                      <div className={styles.timelineDate}>{edu.startYear} – {edu.endYear || 'Present'}</div>
                      <h4 className={styles.timelineTitle}>{edu.degree}</h4>
                      <p className={styles.timelineSubtitle}>{edu.institution}</p>
                      {edu.description && <p className={styles.timelineDesc}>{edu.description}</p>}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className={styles.resumeCategory}>Experience</h3>
                <div className={styles.timeline}>
                  {experiences.map((exp) => (
                    <div key={exp.id} className={styles.timelineItem}>
                      <div className={styles.timelineDate}>{exp.startDate} – {exp.endDate || 'Present'}</div>
                      <h4 className={styles.timelineTitle}>{exp.title}</h4>
                      <p className={styles.timelineSubtitle}>{exp.company} — {exp.location}</p>
                      {exp.highlights.length > 0 && (
                        <ul className={styles.timelineList}>
                          {exp.highlights.map((h, i) => (
                            <li key={i}>{h}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section id="services" className={styles.section}>
          <div className={styles.container}>
            <h2 className={styles.sectionTitle}>Services</h2>
            <p className={styles.sectionSubtitle}>How I typically help teams ship reliable software.</p>

            <div className={styles.servicesGrid}>
              {services.map((service) => (
                <div key={service.id} className={styles.serviceCard}>
                  <div className={styles.serviceIcon}>
                    <span>⚡</span>
                  </div>
                  <h3 className={styles.serviceTitle}>{service.title}</h3>
                  <p className={styles.serviceDesc}>{service.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Portfolio Section */}
        <section id="portfolio" className={styles.section}>
          <div className={styles.container}>
            <h2 className={styles.sectionTitle}>Portfolio</h2>
            <p className={styles.sectionSubtitle}>Personal builds and experiments.</p>

            <div className={styles.projectsGrid}>
              {projects.map((project) => (
                <div key={project.id} className={styles.projectCard}>
                  {project.image && (
                    <div className={styles.projectImage}>
                      <img src={project.image} alt={project.title} />
                    </div>
                  )}
                  <div className={styles.projectContent}>
                    <h3 className={styles.projectTitle}>{project.title}</h3>
                    <div className={styles.projectTags}>
                      {project.technologies.map((tech) => (
                        <span key={tech} className={styles.projectTag}>{tech}</span>
                      ))}
                    </div>
                    <p className={styles.projectDesc}>{project.description}</p>
                    <div className={styles.projectLinks}>
                      {project.liveUrl && (
                        <a href={project.liveUrl} className={styles.projectLink}>
                          <FiExternalLink /> Live Demo
                        </a>
                      )}
                      {project.sourceUrl && (
                        <a href={project.sourceUrl} target="_blank" rel="noopener noreferrer" className={styles.projectLink}>
                          <FiGithub /> Source Code
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className={styles.section}>
          <div className={styles.container}>
            <h2 className={styles.sectionTitle}>FAQ</h2>
            <p className={styles.sectionSubtitle}>Quick answers about how I work.</p>

            <div className={styles.faqGrid}>
              {faqs.map((faq, index) => (
                <div key={faq.id} className={styles.faqItem}>
                  <h3 className={styles.faqQuestion}>
                    <span className={styles.faqNumber}>{index + 1}.</span>
                    {faq.question}
                  </h3>
                  <p className={styles.faqAnswer}>{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className={styles.footer}>
          <div className={styles.container}>
            <div className={styles.footerContent}>
              <p>© {new Date().getFullYear()} Leonard Waugh. All rights reserved.</p>
              <div className={styles.footerLinks}>
                <a href={settings?.linkedIn || '#'} target="_blank" rel="noopener noreferrer">
                  <FiLinkedin />
                </a>
                <a href="https://github.com/thaden0" target="_blank" rel="noopener noreferrer">
                  <FiGithub />
                </a>
                <a href={`mailto:${settings?.email}`}>
                  <FiMail />
                </a>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
