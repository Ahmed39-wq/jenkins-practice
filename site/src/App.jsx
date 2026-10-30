import { useState } from 'react'
import { STAGES, PLACES } from './content.js'

function Pipeline() {
  const [active, setActive] = useState('deploy')
  const stage = STAGES.find((s) => s.key === active)

  return (
    <section aria-labelledby="pipeline-title">
      <div className="wrap">
        <h2 id="pipeline-title">The pipeline</h2>
        <p className="section-note">
          Select a stage to see its part of the Jenkinsfile.
        </p>

        <div className="strip">
          {STAGES.map((s) => (
            <button
              key={s.key}
              type="button"
              className="stage"
              aria-pressed={s.key === active}
              aria-controls="detail"
              onClick={() => setActive(s.key)}
            >
              <span className="name">{s.title}</span>
              <span className="hint">{s.hint}</span>
            </button>
          ))}
        </div>

        <div className="detail" id="detail" role="region" aria-label="Stage details" aria-live="polite">
          <div>
            <h3>{stage.title}</h3>
            <p>{stage.text}</p>
          </div>
          <pre>
            <code>{stage.code}</code>
          </pre>
        </div>
      </div>
    </section>
  )
}

function Places() {
  return (
    <section aria-labelledby="lives-title">
      <div className="wrap">
        <h2 id="lives-title">Where each thing lives</h2>
        <p className="section-note">
          Deleting the server and its data is a normal test here. What comes
          back depends on where a thing is kept.
        </p>

        <div className="cols">
          {PLACES.map((p) => (
            <div className="col" key={p.title}>
              <h3>{p.title}</h3>
              <p className="what">{p.what}</p>
              <ul>
                {p.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="fate">{p.fate}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Broke() {
  return (
    <section aria-labelledby="broke-title">
      <div className="wrap">
        <h2 id="broke-title">What broke on the way</h2>
        <ul className="broke">
          <li>
            <strong>Docker said virtualization wasn’t detected.</strong> The
            hardware setting was on; WSL 2 wasn’t installed.{' '}
            <code>wsl --install</code> and a restart fixed it.
          </li>
          <li>
            <strong>Git Bash rewrote paths meant for containers.</strong>{' '}
            <code>/var/run/docker.sock</code> became a Windows path until the
            command started with <code>MSYS_NO_PATHCONV=1</code>.
          </li>
          <li>
            <strong>A new setting didn’t show up in Jenkins.</strong> The
            running container was still on the old image. Build, remove the
            container, run it again.
          </li>
          <li>
            <strong>The fetch failed with “not in a git directory”.</strong> A
            leftover workspace clone was the likely cause. Deleting the
            workspace folder let Jenkins start clean.
          </li>
        </ul>
      </div>
    </section>
  )
}

export default function App() {
  return (
    <>
      <header>
        <div className="wrap">
          <h1>A Jenkins server you can rebuild from a git repo</h1>
          <p className="lede">
            This page is the last step of a practice pipeline. Pushing to main
            starts a build in Jenkins, which tests the project, builds this
            React app in a fresh container, and then asks Render to publish it.
          </p>
        </div>
      </header>

      <main>
        <Pipeline />
        <Places />
        <Broke />
      </main>

      <footer>
        <div className="wrap">
          <p>Pushed to main, tested in node:18, published by Jenkins.</p>
        </div>
      </footer>
    </>
  )
}
