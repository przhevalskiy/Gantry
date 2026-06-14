'use client';

import { useRef, useState, useEffect } from 'react';

export const SUGGESTION_CATEGORIES: { label: string; items: string[] }[] = [
  {
    label: 'Web App',
    items: [
      'Build a SaaS dashboard with Next.js, Tailwind, and Supabase auth',
      'Create a React e-commerce storefront with cart, checkout, and Stripe',
      'Build a multi-tenant admin panel with role-based access control',
      'Create a real-time collaborative whiteboard with WebSockets',
      'Build a full-stack blog with a headless CMS and RSS feed',
      'Create a Kanban board app with drag-and-drop and team sharing',
      'Build a social network with profiles, follows, and activity feed',
      'Create a booking and scheduling platform with calendar integration',
    ],
  },
  {
    label: 'API',
    items: [
      'Build a REST API with FastAPI, PostgreSQL, and JWT auth',
      'Create a GraphQL API with subscriptions and DataLoader',
      'Build a gRPC microservice with Protobuf schemas',
      'Create a WebSocket server for real-time event streaming',
      'Build a rate-limited public API with API key management',
      'Create an OpenAPI-documented CRUD service with Swagger UI',
      'Build a webhook delivery system with retries and event logs',
      'Create a search API with Elasticsearch full-text and filters',
    ],
  },
  {
    label: 'Mobile',
    items: [
      'Build a React Native iOS and Android app with Expo',
      'Create a fitness tracker with local storage, charts, and reminders',
      'Build a push-notification enabled news reader in React Native',
      'Create a cross-platform expense tracker with offline sync',
      'Build a social feed app with camera, likes, and comments',
      'Create a food delivery app with maps, order tracking, and payments',
      'Build a habit tracker with streaks, badges, and weekly reports',
    ],
  },
  {
    label: 'Data / ML',
    items: [
      'Build an ETL pipeline with Airflow, dbt, and Postgres',
      'Create a machine learning inference API with FastAPI and scikit-learn',
      'Build a real-time analytics dashboard with ClickHouse and Grafana',
      'Create a RAG chatbot with LangChain, embeddings, and vector search',
      'Build a data scraper with deduplication, scheduling, and alerts',
      'Create a model fine-tuning pipeline with experiment tracking in MLflow',
      'Build a recommendation engine with collaborative filtering',
      'Create a document classification system with confidence scores',
    ],
  },
  {
    label: 'DevOps',
    items: [
      'Set up a CI/CD pipeline with GitHub Actions, Docker, and auto-deploy',
      'Create Kubernetes manifests with Helm charts and resource limits',
      'Build a Terraform infrastructure module for AWS ECS + RDS',
      'Set up observability with OpenTelemetry, Prometheus, and Grafana',
      'Create a Docker Compose dev environment with hot reload and seed data',
      'Build a self-hosted deployment with Nginx, SSL, and rolling updates',
      'Create a secrets management system with Vault and rotation policies',
      'Build a multi-environment deployment pipeline with approval gates',
    ],
  },
  {
    label: 'CLI / Tools',
    items: [
      'Build a CLI tool in Python with Rich, subcommands, and config files',
      'Create a code generator that scaffolds projects from templates',
      'Build a Git hook toolkit with lint, type-check, and commit formatting',
      'Create a local dev proxy with request logging and mock responses',
      'Build an automated dependency audit and update tool',
      'Create a dotfiles manager with symlinks and machine profiles',
      'Build a terminal dashboard for monitoring system resources',
    ],
  },
  {
    label: 'Realtime',
    items: [
      'Build a multiplayer chat app with rooms, presence, and history',
      'Create a live coding interview platform with shared editor and video',
      'Build a real-time stock ticker dashboard with WebSocket feeds',
      'Create a collaborative document editor with conflict resolution (CRDT)',
      'Build a live auction platform with bidding, timers, and notifications',
      'Create a sports score tracker with live commentary and push alerts',
      'Build a shared music queue with voting and playback sync',
    ],
  },
  {
    label: 'Game',
    items: [
      'Build a browser-based Tetris clone with leaderboard',
      'Create a multiplayer tic-tac-toe game with matchmaking',
      'Build a text adventure engine with branching story and inventory',
      'Create a 2D platformer with Phaser.js and level editor',
      'Build a chess game with AI opponent using minimax',
      'Create a tower defense game with wave editor and upgrades',
      'Build a trivia game with categories, timers, and score history',
      'Create a card battle game with deck building and multiplayer rooms',
    ],
  },
  {
    label: 'Auth / Identity',
    items: [
      'Build a full auth system with OAuth2, MFA, and session management',
      'Create a passwordless login flow with magic links and TOTP',
      'Build an SSO provider with SAML 2.0 and OIDC support',
      'Create an API key management portal with scopes and audit logs',
      'Build a permission system with roles, resources, and policy engine',
      'Create a user onboarding flow with email verification and profile setup',
    ],
  },
  {
    label: 'E-commerce',
    items: [
      'Build a Shopify-style storefront with product variants and inventory',
      'Create a subscription billing system with Stripe and plan management',
      'Build a marketplace with multi-vendor payouts and escrow',
      'Create a digital downloads platform with license key generation',
      'Build a B2B wholesale portal with tiered pricing and net terms',
      'Create a flash sale engine with countdown timers and stock limits',
    ],
  },
  {
    label: 'AI / Agents',
    items: [
      'Build an AI coding assistant with file context and inline suggestions',
      'Create a multi-agent research pipeline with source citations',
      'Build a document Q&A system with PDF parsing and RAG',
      'Create an AI customer support bot with escalation and ticket creation',
      'Build an autonomous web scraper agent with self-correcting retries',
      'Create a personal AI assistant with memory, tools, and calendar access',
      'Build a code review agent that flags bugs, security issues, and style',
    ],
  },
  {
    label: 'Finance',
    items: [
      'Build a personal finance tracker with budgets, goals, and reports',
      'Create a crypto portfolio tracker with live prices and P&L',
      'Build an invoice generator with PDF export and payment tracking',
      'Create a payroll processing system with tax calculations',
      'Build a trading journal with strategy tagging and performance analytics',
      'Create an expense approval workflow with receipts and accounting export',
    ],
  },
  {
    label: 'Productivity',
    items: [
      'Build a note-taking app with markdown, tags, and full-text search',
      'Create a project management tool with tasks, milestones, and Gantt chart',
      'Build a CRM with contact management, pipeline, and email tracking',
      'Create a meeting scheduler with availability sync and video links',
      'Build a bookmark manager with AI tagging and browser extension',
      'Create a daily planner with time blocking, habits, and weekly review',
    ],
  },
  {
    label: 'Media',
    items: [
      'Build a video streaming platform with transcoding and adaptive bitrate',
      'Create a podcast hosting platform with RSS, analytics, and chapters',
      'Build an image gallery with AI tagging, albums, and sharing',
      'Create a music streaming app with playlists, lyrics, and scrobbling',
      'Build a screen recording tool with annotations and team sharing',
      'Create a newsletter platform with editor, scheduling, and open tracking',
    ],
  },
  {
    label: 'IoT / Hardware',
    items: [
      'Build a home automation dashboard for MQTT devices',
      'Create a sensor data ingestion pipeline with time-series storage',
      'Build a fleet management system for IoT device telemetry',
      'Create a firmware OTA update service with rollback and versioning',
      'Build an alert system for threshold breaches on sensor readings',
    ],
  },
];

const ACCENT = '#f97316';

export function SuggestionCategories({
  isPending,
  onSelect,
}: {
  isPending: boolean;
  onSelect: (item: string) => void;
}) {
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [categoryFlip, setCategoryFlip] = useState<'up' | 'down'>('down');
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!openCategory) return;
    const handler = (e: MouseEvent) => {
      const ref = categoryRefs.current[openCategory];
      if (ref && !ref.contains(e.target as Node)) setOpenCategory(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openCategory]);

  return (
    <div style={{ marginTop: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
      {SUGGESTION_CATEGORIES.map(cat => {
        const isOpen = openCategory === cat.label;
        return (
          <div
            key={cat.label}
            ref={el => { categoryRefs.current[cat.label] = el; }}
            style={{ position: 'relative' }}
          >
            <button
              type="button"
              onMouseDown={e => {
                e.preventDefault();
                if (isOpen) { setOpenCategory(null); return; }
                const btn = e.currentTarget as HTMLButtonElement;
                const rect = btn.getBoundingClientRect();
                const estimatedHeight = cat.items.length * 48 + 16;
                const flip = rect.bottom + estimatedHeight > window.innerHeight ? 'up' : 'down';
                setCategoryFlip(flip);
                setOpenCategory(cat.label);
              }}
              disabled={isPending}
              style={{
                background: isOpen ? ACCENT : 'transparent',
                border: `1px solid ${isOpen ? ACCENT : 'var(--border)'}`,
                borderRadius: '999px',
                padding: '0.375rem 0.875rem',
                color: isOpen ? 'white' : 'var(--text-secondary)',
                fontSize: '0.8125rem', cursor: 'pointer',
                fontFamily: 'inherit', transition: 'all 0.12s ease',
                display: 'flex', alignItems: 'center', gap: '0.3rem',
              }}
            >
              {cat.label}
              <span style={{ opacity: 0.6, fontSize: '0.6rem' }}>{isOpen ? '▴' : '▾'}</span>
            </button>

            {isOpen && (
              <div style={{
                position: 'absolute',
                ...(categoryFlip === 'up'
                  ? { bottom: 'calc(100% + 6px)' }
                  : { top: 'calc(100% + 6px)' }),
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '12px', overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                zIndex: 300, minWidth: '280px', maxWidth: '340px',
                maxHeight: '60vh', overflowY: 'auto',
              }}>
                {cat.items.map((item, idx) => (
                  <button
                    key={item}
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault();
                      onSelect(item);
                      setOpenCategory(null);
                    }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '0.625rem 0.875rem',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: idx < cat.items.length - 1 ? '1px solid var(--border)' : 'none',
                      fontSize: '0.8125rem', color: 'var(--text-primary)',
                      cursor: 'pointer', fontFamily: 'inherit',
                      lineHeight: '1.4',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${ACCENT}10`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
