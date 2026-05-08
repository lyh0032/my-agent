<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const canvasRef = ref<HTMLCanvasElement | null>(null)

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  alpha: number
}

const PARTICLE_COUNT = 120
const MAX_DIST = 150
const MOUSE_RADIUS = 200
let particles: Particle[] = []
let mouse = { x: -9999, y: -9999 }
let animationId = 0
let w = 0
let h = 0

function resize() {
  const c = canvasRef.value
  if (!c) return
  w = window.innerWidth
  h = window.innerHeight
  c.width = w * devicePixelRatio
  c.height = h * devicePixelRatio
  c.style.width = `${w}px`
  c.style.height = `${h}px`
}

function initParticles() {
  particles = Array.from({ length: PARTICLE_COUNT }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.6,
    vy: (Math.random() - 0.5) * 0.6,
    radius: Math.random() * 2 + 1,
    alpha: Math.random() * 0.5 + 0.3
  }))
}

function draw() {
  const c = canvasRef.value
  if (!c) return
  const ctx = c.getContext('2d')
  if (!ctx) return

  ctx.scale(devicePixelRatio, devicePixelRatio)

  // background
  const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.8)
  grad.addColorStop(0, '#14142a')
  grad.addColorStop(0.5, '#0e0e1a')
  grad.addColorStop(1, '#06060d')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, w, h)

  // update & draw particles
  for (const p of particles) {
    const dx = mouse.x - p.x
    const dy = mouse.y - p.y
    const dist = Math.hypot(dx, dy)
    if (dist < MOUSE_RADIUS) {
      const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS * 0.3
      p.vx -= (dx / dist) * force
      p.vy -= (dy / dist) * force
    }

    p.x += p.vx
    p.y += p.vy
    p.vx += (Math.random() - 0.5) * 0.1
    p.vy += (Math.random() - 0.5) * 0.1
    p.vx *= 0.98
    p.vy *= 0.98

    if (p.x < 0) p.x = w
    if (p.x > w) p.x = 0
    if (p.y < 0) p.y = h
    if (p.y > h) p.y = 0

    // glow
    ctx.beginPath()
    const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius * 4)
    grd.addColorStop(0, `rgba(140, 180, 255, ${p.alpha * 0.6})`)
    grd.addColorStop(1, `rgba(140, 180, 255, 0)`)
    ctx.fillStyle = grd
    ctx.arc(p.x, p.y, p.radius * 4, 0, Math.PI * 2)
    ctx.fill()

    // dot
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(200, 220, 255, ${p.alpha})`
    ctx.fill()
  }

  // lines
  ctx.strokeStyle = 'rgba(140, 180, 255, 0.06)'
  ctx.lineWidth = 0.5
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x
      const dy = particles[i].y - particles[j].y
      const dist = Math.hypot(dx, dy)
      if (dist < MAX_DIST) {
        ctx.beginPath()
        ctx.moveTo(particles[i].x, particles[i].y)
        ctx.lineTo(particles[j].x, particles[j].y)
        ctx.stroke()
      }
    }
  }

  ctx.resetTransform()
  animationId = requestAnimationFrame(draw)
}

function onMouseMove(e: MouseEvent) {
  mouse.x = e.clientX
  mouse.y = e.clientY
}

function onMouseLeave() {
  mouse.x = -9999
  mouse.y = -9999
}

onMounted(() => {
  resize()
  initParticles()
  draw()
  window.addEventListener('resize', resize)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseleave', onMouseLeave)
})

onUnmounted(() => {
  cancelAnimationFrame(animationId)
  window.removeEventListener('resize', resize)
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseleave', onMouseLeave)
})
</script>

<template>
  <canvas ref="canvasRef" class="animated-bg" />
</template>

<style scoped>
.animated-bg {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 0;
  pointer-events: none;
}
</style>
