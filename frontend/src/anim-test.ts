// Temporary manual test harness: /anim-test.html?a=<name>
import { CELEBRATIONS } from './components/celebrations/animations'
import { REWARD_ANIMATIONS } from './components/celebrations/reward-animations'

const all = [...CELEBRATIONS, ...REWARD_ANIMATIONS]
const name = new URLSearchParams(location.search).get('a') ?? 'dino'
const anim = all.find((a) => a.name === name)
const stage = document.getElementById('stage')!
const canvas = document.getElementById('c') as HTMLCanvasElement

if (!anim) {
  document.body.innerHTML = `<pre style="color:#fff">unknown: ${name}\navailable: ${all.map((a) => a.name).join(', ')}</pre>`
} else {
  stage.style.background = anim.backdrop
  ;(window as any).cleanup = anim.run(canvas)
  console.log('playing', anim.name)
}
