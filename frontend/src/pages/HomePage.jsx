import { useRef, useEffect, useCallback, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import {
  Sparkles, Brain, FileEdit, SpellCheck, ShieldCheck,
  ArrowRight, Check, Crown, Zap, Rocket, ChevronDown,
  Monitor, PenTool, GraduationCap, Cpu, BarChart3,
  Star, MousePointerClick
} from 'lucide-react';

/* ─── tiny scroll-animated wrapper ─── */
function Reveal({ children, className = '', delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [.22, 1, .36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}


/* ═══════════════════════════════════════════════ */
/*                   HOME PAGE                     */
/* ═══════════════════════════════════════════════ */
export default function HomePage() {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="relative w-full min-h-screen">

      <div className="relative z-10 w-full overflow-hidden">
        <HeroSection />
        <WhatIsSection />
        <FeaturesSection />
        <HowItWorksSection />
        <PricingSection />
        <CTASection />
      </div>
    </div>
  );
}

/* ── Premium Floating SaaS Objects ── */
function FloatingObjects() {
  const objects = [
    { type: 'ring', color: 'border-indigo-500/20', size: 100, initial: { x: '-20vw', y: '-30vh' }, animate: { x: ['-20vw', '-15vw', '-25vw', '-20vw'], y: ['-30vh', '-10vh', '-20vh', '-30vh'], rotate: [0, 90, 180, 360] }, duration: 25 },
    { type: 'orb', color: 'bg-indigo-500/10 blur-[2px]', size: 60, initial: { x: '30vw', y: '-25vh' }, animate: { x: ['30vw', '25vw', '35vw', '30vw'], y: ['-25vh', '-10vh', '-30vh', '-25vh'] }, duration: 20 },
    { type: 'ring', color: 'border-purple-500/15', size: 220, initial: { x: '25vw', y: '20vh' }, animate: { x: ['25vw', '35vw', '20vw', '25vw'], y: ['20vh', '5vh', '25vh', '20vh'], rotate: [0, -90, -180, -360] }, duration: 35 },
    { type: 'orb', color: 'bg-violet-500/10 blur-[1px]', size: 40, initial: { x: '-32vw', y: '15vh' }, animate: { x: ['-32vw', '-25vw', '-38vw', '-32vw'], y: ['15vh', '30vh', '10vh', '15vh'] }, duration: 22 },
    { type: 'ring', color: 'border-blue-500/20', size: 160, initial: { x: '0vw', y: '-35vh' }, animate: { x: ['0vw', '10vw', '-10vw', '0vw'], y: ['-35vh', '-20vh', '-40vh', '-35vh'], rotate: [0, 60, 120, 360] }, duration: 28 },
    { type: 'orb', color: 'bg-blue-500/10 blur-[3px]', size: 80, initial: { x: '-15vw', y: '28vh' }, animate: { x: ['-15vw', '-5vw', '-25vw', '-15vw'], y: ['28vh', '15vh', '35vh', '28vh'] }, duration: 24 },
    { type: 'glass', color: 'bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl', size: 120, initial: { x: '40vw', y: '5vh' }, animate: { x: ['40vw', '35vw', '45vw', '40vw'], y: ['5vh', '20vh', '-5vh', '5vh'], rotate: [0, 45, -45, 0] }, duration: 30 },
    { type: 'glass', color: 'bg-white/5 backdrop-blur-md border border-white/10 rounded-full', size: 90, initial: { x: '-40vw', y: '-5vh' }, animate: { x: ['-40vw', '-35vw', '-48vw', '-40vw'], y: ['-5vh', '-20vh', '5vh', '-5vh'], rotate: [0, -45, 45, 0] }, duration: 32 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none -z-30">
      <div className="absolute top-1/2 left-1/2 w-full h-full -translate-x-1/2 -translate-y-1/2">
        {objects.map((obj, i) => (
          <motion.div
            key={i}
            className={`absolute ${obj.type === 'ring' ? 'rounded-full border-[2px]' : ''} ${obj.type === 'orb' ? 'rounded-full' : ''} ${obj.color}`}
            style={{ 
              width: obj.size, 
              height: obj.size, 
              left: '50%', 
              top: '50%',
              marginLeft: -(obj.size / 2),
              marginTop: -(obj.size / 2),
            }}
            initial={obj.initial}
            animate={obj.animate}
            transition={{ duration: obj.duration, repeat: Infinity, ease: 'linear' }}
          />
        ))}
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   1. HERO — Premium SaaS-level first impression
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function HeroSection() {
  return (
    <section className="relative min-h-[94vh] flex items-center justify-center text-center px-6 overflow-hidden">
      
      {/* ── LOCALIZED ANIMATED OBJECTS ── */}
      <FloatingObjects />

      {/* Subtle Depth Grid */}
      <div
        className="absolute inset-0 -z-20 opacity-[0.02] dark:opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(148,163,247,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,247,.6) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />

      {/* Seamless Fade Mask at Bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-slate-50 dark:from-[#111827] to-transparent pointer-events-none -z-10" />

      {/* Radial soft spotlight behind text to enhance readability */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[600px] bg-slate-50/50 dark:bg-[#111827]/60 blur-[100px] rounded-full pointer-events-none -z-10" />

      {/* ═══ CONTENT ═══ */}
      <div className="max-w-4xl mx-auto relative z-10">

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="inline-flex items-center gap-2.5 px-5 py-2 mb-10 rounded-full border border-indigo-400/25 bg-indigo-500/8 backdrop-blur-md"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-400" />
          </span>
          <span className="text-indigo-300 text-sm font-medium tracking-wide">AI-Powered Exam Platform</span>
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35 }}
          className="text-5xl sm:text-6xl lg:text-[5.2rem] font-black tracking-tight text-white leading-[1.08] mb-7"
          style={{ fontFamily: 'Outfit, sans-serif' }}
        >
          Smarter Exams,{' '}
          <br className="hidden sm:block" />
          <span className="hero-gradient-text">
            Instant Results
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed"
        >
          Create exams, evaluate answers with AI, and review UML diagrams — all in one beautiful, easy-to-use platform built for modern education.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.65 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          {/* Primary CTA with animated gradient border */}
          <Link to="/register" className="hero-cta-primary group">
            <span className="relative z-10 flex items-center gap-2.5">
              Get Started Free
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
            </span>
          </Link>

          {/* Secondary CTA */}
          <Link
            to="/login"
            className="inline-flex items-center gap-2.5 text-slate-300 hover:text-white font-medium py-3.5 px-7 rounded-2xl border border-white/10 hover:border-white/25 transition-all duration-300 bg-white/5 hover:bg-white/10 backdrop-blur-sm text-base"
          >
            <MousePointerClick className="h-5 w-5" />
            Sign In
          </Link>
        </motion.div>

        {/* Trust bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
          className="mt-20"
        >
          <div className="flex items-center justify-center gap-8 sm:gap-14">
            {[
              { label: 'AI Grading', icon: Brain },
              { label: 'UML Support', icon: PenTool },
              { label: 'Real-time Analytics', icon: BarChart3 },
            ].map(({ label, icon: Icon }) => (
              <div key={label} className="flex items-center gap-2.5 group">
                <div className="p-1.5 rounded-lg bg-white/5 border border-white/8 group-hover:border-indigo-500/30 transition-colors">
                  <Icon className="h-3.5 w-3.5 text-indigo-400" />
                </div>
                <span className="text-sm font-medium text-slate-500 group-hover:text-slate-300 transition-colors">{label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   2. WHAT IS THIS SYSTEM?
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function WhatIsSection() {
  const items = [
    {
      icon: FileEdit,
      color: 'from-indigo-500 to-blue-600',
      title: 'Create Exams',
      desc: 'Build exams in minutes with an intuitive editor supporting multiple question types including essays and UML diagrams.',
    },
    {
      icon: Brain,
      color: 'from-violet-500 to-purple-600',
      title: 'AI Grading',
      desc: 'Our AI engine evaluates answers semantically — understanding meaning, not just keywords — for fair and accurate scoring.',
    },
    {
      icon: PenTool,
      color: 'from-pink-500 to-rose-600',
      title: 'UML Evaluation',
      desc: 'Students draw UML diagrams directly in the browser, and the system intelligently compares them against model answers.',
    },
  ];

  return (
    <section className="py-24 sm:py-32 px-6 lg:px-8" id="about">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-1.5 text-indigo-500 text-sm font-semibold uppercase tracking-widest mb-4">
              <Sparkles className="h-4 w-4" /> About the Platform
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
              What is ExamFlow?
            </h2>
            <p className="mt-4 text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
              A next-generation exam system that combines smart creation tools with AI-powered evaluation.
            </p>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-8">
          {items.map((item, i) => (
            <Reveal key={item.title} delay={i * 0.12}>
              <div className="group relative rounded-3xl p-8 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/40 dark:hover:border-indigo-500/30 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/10">
                <div className={`inline-flex p-3.5 rounded-2xl bg-gradient-to-br ${item.color} mb-6 shadow-lg`}>
                  <item.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{item.title}</h3>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   3. FEATURES
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function FeaturesSection() {
  const features = [
    {
      icon: FileEdit,
      title: 'Create Exams Easily',
      desc: 'Intuitive exam builder with drag-and-drop question ordering and real-time preview.',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Brain,
      title: 'AI Correction & Grading',
      desc: 'Semantic AI engine that understands meanings, synonyms, and context for accurate evaluation.',
      gradient: 'from-violet-500 to-purple-500',
    },
    {
      icon: PenTool,
      title: 'UML Diagram Support',
      desc: 'Full UML editor with class, use-case, and activity diagrams — graded automatically by AI.',
      gradient: 'from-pink-500 to-rose-500',
    },
    {
      icon: SpellCheck,
      title: 'Smart Typo Correction',
      desc: 'AI tolerates minor spelling mistakes and focuses on understanding the actual answer.',
      gradient: 'from-amber-500 to-orange-500',
    },
    {
      icon: ShieldCheck,
      title: 'Instructor Control',
      desc: 'Full control over timing, question weights, model answers, and grade overrides.',
      gradient: 'from-emerald-500 to-teal-500',
    },
    {
      icon: BarChart3,
      title: 'Real-time Analytics',
      desc: 'Instant access to submission stats, grade distributions, and performance insights.',
      gradient: 'from-indigo-500 to-blue-500',
    },
  ];

  return (
    <section className="py-24 sm:py-32 px-6 lg:px-8 relative" id="features">
      {/* Subtle background accent */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-1.5 text-indigo-500 text-sm font-semibold uppercase tracking-widest mb-4">
              <Zap className="h-4 w-4" /> Features
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Everything You Need
            </h2>
            <p className="mt-4 text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
              Powerful tools designed to make exam management effortless and intelligent.
            </p>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.08}>
              <div className="group relative rounded-2xl p-7 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/40 dark:hover:border-indigo-500/30 transition-all duration-500 hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-500/5 h-full">
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${f.gradient} mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                  <f.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   4. HOW IT WORKS
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function HowItWorksSection() {
  const steps = [
    {
      num: '01',
      title: 'Create Your Exam',
      desc: 'Instructors design exams with a powerful editor — set the title, duration, passing score, and add questions of any type.',
      img: '/images/landing/step1.png',
      icon: Monitor,
    },
    {
      num: '02',
      title: 'Add Questions & UML',
      desc: 'Add multiple-choice, essay, and UML diagram questions. Provide model answers so the AI knows what to evaluate against.',
      img: '/images/landing/step2.png',
      icon: PenTool,
    },
    {
      num: '03',
      title: 'Students Take the Exam',
      desc: 'Students join via link or QR code, answer questions in a clean interface with a live timer and progress tracking.',
      img: '/images/landing/step3.png',
      icon: GraduationCap,
    },
    {
      num: '04',
      title: 'AI Evaluates Answers',
      desc: 'The AI engine analyzes each response semantically — understanding concepts, detecting synonyms, and grading fairly.',
      img: '/images/landing/step4.png',
      icon: Cpu,
    },
    {
      num: '05',
      title: 'Review Results & Analytics',
      desc: 'Instructors review detailed results, adjust grades if needed, and export comprehensive reports with full analytics.',
      img: '/images/landing/step5.png',
      icon: BarChart3,
    },
  ];

  return (
    <section className="py-24 sm:py-32 px-6 lg:px-8" id="how-it-works">
      <div className="max-w-6xl mx-auto">
        <Reveal>
          <div className="text-center mb-20">
            <span className="inline-flex items-center gap-1.5 text-indigo-500 text-sm font-semibold uppercase tracking-widest mb-4">
              <Rocket className="h-4 w-4" /> How it Works
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
              From Creation to Results
            </h2>
            <p className="mt-4 text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
              A simple, streamlined workflow that takes the complexity out of exam management.
            </p>
          </div>
        </Reveal>

        <div className="space-y-20 lg:space-y-28">
          {steps.map((step, i) => {
            const isEven = i % 2 === 0;
            return (
              <Reveal key={step.num} delay={0.1}>
                <div className={`flex flex-col ${isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-10 lg:gap-16`}>
                  {/* Image */}
                  <div className="w-full lg:w-1/2">
                    <div className="relative group">
                      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-indigo-500/20 via-violet-500/10 to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                      <img
                        src={step.img}
                        alt={step.title}
                        className="relative w-full rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl group-hover:shadow-2xl group-hover:shadow-indigo-500/10 transition-all duration-500"
                        loading="lazy"
                      />
                    </div>
                  </div>

                  {/* Text */}
                  <div className="w-full lg:w-1/2 space-y-4">
                    <div className="flex items-center gap-4">
                      <span className="text-4xl font-black text-indigo-500/20 dark:text-indigo-500/15 select-none" style={{ fontFamily: 'Outfit' }}>{step.num}</span>
                      <div className="inline-flex p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                        <step.icon className="h-5 w-5 text-indigo-500" />
                      </div>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white" style={{ fontFamily: 'Outfit' }}>
                      {step.title}
                    </h3>
                    <p className="text-lg text-slate-500 dark:text-slate-400 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   5. PRICING / SUBSCRIPTION
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function PricingSection() {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: '/month',
      desc: 'Ideal for small or solo classes',
      icon: Zap,
      gradient: 'from-slate-500 to-slate-600',
      features: ['Up to 10 exams/mo', 'Up to 20 students', 'Standard AI grading', 'Basic analytics', 'Email support'],
      popular: false,
    },
    {
      name: 'Starter',
      price: '$29',
      period: '/month',
      desc: 'For growing classrooms',
      icon: Rocket,
      gradient: 'from-emerald-500 to-teal-600',
      features: ['Up to 50 exams/mo', 'Up to 100 students', 'Enhanced AI auto-grading', 'Standard analytics', 'Priority support'],
      popular: false,
    },
    {
      name: 'Professional',
      price: '$79',
      period: '/month',
      desc: 'Perfect for instructors',
      icon: Star,
      gradient: 'from-indigo-500 to-violet-600',
      features: ['Up to 150 exams/mo', 'Up to 500 students', 'Advanced AI algorithms', 'Export & Full reporting', '24/7 Priority support'],
      popular: true,
    },
    {
      name: 'Business',
      price: '$149',
      period: '/month',
      desc: 'For larger departments',
      icon: ShieldCheck,
      gradient: 'from-blue-500 to-cyan-600',
      features: ['Up to 500 exams/mo', 'Up to 2000 students', 'Customizable models', 'API access integrations', 'Dedicated manager'],
      popular: false,
    },
  ];

  return (
    <section className="py-24 sm:py-32 px-6 lg:px-8 relative" id="pricing">
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-[85rem] mx-auto">
        <Reveal>
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-1.5 text-indigo-500 text-sm font-semibold uppercase tracking-widest mb-4">
              <Crown className="h-4 w-4" /> Pricing
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Simple, Transparent Pricing
            </h2>
            <p className="mt-4 text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
              Choose the plan that fits your needs. Upgrade or downgrade at any time.
            </p>

            {/* Trial notice */}
            <div className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-sm font-medium">
              <Sparkles className="h-4 w-4" />
              Currently in trial phase — subscriptions will be available soon
            </div>
          </div>
        </Reveal>

        <div className="relative rounded-[2.5rem] border border-slate-200/50 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] p-6 sm:p-10 mt-8">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
            {plans.map((plan, i) => (
              <div key={plan.name} className={`relative rounded-3xl p-6 transition-all duration-300 hover:shadow-2xl ${
                  plan.popular
                    ? 'bg-gradient-to-b from-indigo-600 to-violet-700 text-white shadow-2xl scale-[1.02] border border-indigo-400/50'
                    : 'bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800'
                }`}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-white text-indigo-600 text-[10px] font-bold uppercase tracking-wider rounded-full shadow-lg">
                      Most Popular
                    </div>
                  )}

                  <div className={`inline-flex p-3 rounded-2xl bg-gradient-to-br ${plan.gradient} mb-5 shadow-lg`}>
                    <plan.icon className="h-6 w-6 text-white" />
                  </div>

                  <h3 className={`text-xl font-bold mb-1 ${plan.popular ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{plan.name}</h3>
                  <p className={`text-sm mb-6 ${plan.popular ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'}`}>{plan.desc}</p>

                  <div className="flex items-baseline gap-1 mb-8">
                    <span className={`text-4xl font-black ${plan.popular ? 'text-white' : 'text-slate-900 dark:text-white'}`} style={{ fontFamily: 'Outfit' }}>{plan.price}</span>
                    {plan.period && <span className={`text-sm ${plan.popular ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'}`}>{plan.period}</span>}
                  </div>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-3 text-sm">
                        <Check className={`h-4 w-4 flex-shrink-0 ${plan.popular ? 'text-indigo-200' : 'text-indigo-500'}`} />
                        <span className={plan.popular ? 'text-indigo-100' : 'text-slate-600 dark:text-slate-400'}>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    disabled
                    className={`w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 cursor-not-allowed opacity-40 border ${
                      plan.popular
                        ? 'bg-white/10 border-white/20 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                    }`}
                  >
                    Coming Soon
                  </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   6. FINAL CTA
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
function CTASection() {
  return (
    <section className="py-24 sm:py-32 px-6 lg:px-8">
      <Reveal>
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-pink-500/10 blur-2xl" />
          <div className="relative rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl p-12 sm:p-16">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-4" style={{ fontFamily: 'Outfit' }}>
              Ready to Transform Your Exams?
            </h2>
            <p className="text-lg text-slate-500 dark:text-slate-400 mb-8 max-w-xl mx-auto">
              Join ExamFlow today and experience the future of exam creation and AI grading.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/register"
                className="group inline-flex items-center gap-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3.5 px-8 rounded-2xl transition-all duration-300 shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-95 text-base"
              >
                Start for Free
                <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-indigo-500 dark:hover:text-indigo-400 font-medium py-3.5 px-6 rounded-2xl border border-slate-300 dark:border-slate-700 hover:border-indigo-500/50 transition-all duration-300 text-base"
              >
                Sign In Instead
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
