import { motion } from 'framer-motion'
import { AcademicCapIcon } from '@heroicons/react/24/outline'

const fadeUp = {
  hidden: { opacity: 0, y: 25 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.12, duration: 0.5 } }),
}

const members = [
  { name: 'Syed Jawad Ali', reg: 'FA22-BCS-055', role: 'Developer', gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)' },
  { name: 'Dr. Faisal Azam', reg: '', role: 'Project Supervisor', gradient: 'linear-gradient(135deg, #6366f1, #818cf8)' },
  { name: 'Saad Shahzad', reg: 'FA22-BCS-114', role: 'Developer', gradient: 'linear-gradient(135deg, #8b5cf6, #c084fc)' },
]

export default function TeamSection() {
  return (
    <section className="py-24 px-6" id="team">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.1)' }}>
            <AcademicCapIcon className="w-6 h-6" style={{ color: '#818cf8' }} />
          </div>
          <span className="text-sm font-semibold tracking-wider uppercase" style={{ color: '#818cf8' }}>Final Year Project</span>
          <h2 className="text-3xl font-bold mt-3 mb-2" style={{ color: '#e2e8f0' }}>Built at COMSATS University Islamabad</h2>
          <p className="text-sm mb-12" style={{ color: 'rgba(148,163,184,0.5)' }}>Department of Computer Science — BS Computer Science</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-5">
          {members.map((m, i) => (
            <motion.div key={i} className="rounded-2xl p-6 transition-all duration-250 cursor-default" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
              style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.12)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)' }}
            >
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-lg font-bold mx-auto mb-4" style={{ background: m.gradient, boxShadow: '0 4px 20px rgba(99,102,241,0.2)' }}>
                {m.name.split(' ').map(n => n[0]).join('')}
              </div>
              <h3 className="font-semibold text-base" style={{ color: '#e2e8f0' }}>{m.name}</h3>
              {m.reg && <p className="text-xs mt-0.5" style={{ color: 'rgba(148,163,184,0.4)' }}>{m.reg}</p>}
              <p className="text-sm mt-1" style={{ color: '#818cf8' }}>{m.role}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
