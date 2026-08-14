function Resources({ setPage }) {
  return (
    <div className="resources-page">

      <div className="resources-header">

        <div>
          <p className="card-eyebrow">
            REVISION RESOURCES
          </p>

          <h1>
            Specifications & Past Papers
          </h1>

          <p>
            Find specifications, past papers and mark schemes
            for your A-level subjects.
          </p>
        </div>

        <button
          className="home-outline-button"
          onClick={() => setPage("revision")}
        >
          ← Back to Revision
        </button>

      </div>


      {/* SUBJECTS */}

      <div className="resource-subject-grid">

        <button className="resource-subject-card">

          <div className="resource-subject-icon">
            📐
          </div>

          <div>
            <span>WJEC</span>
            <h2>Mathematics</h2>
            <p>
              AS & A Level Mathematics specifications,
              past papers and mark schemes.
            </p>
          </div>

          <strong>→</strong>

        </button>


        <button className="resource-subject-card">

          <div className="resource-subject-icon">
            ➕
          </div>

          <div>
            <span>WJEC</span>
            <h2>Further Mathematics</h2>
            <p>
              Further Mathematics specifications,
              past papers and mark schemes.
            </p>
          </div>

          <strong>→</strong>

        </button>


        <button className="resource-subject-card">

          <div className="resource-subject-icon">
            📖
          </div>

          <div>
            <span>WJEC</span>
            <h2>English Literature</h2>
            <p>
              Specifications, assessment materials
              and past papers.
            </p>
          </div>

          <strong>→</strong>

        </button>


        <button className="resource-subject-card">

          <div className="resource-subject-icon">
            🏛️
          </div>

          <div>
            <span>WJEC</span>
            <h2>History</h2>
            <p>
              Specifications, past papers and
              historical assessment materials.
            </p>
          </div>

          <strong>→</strong>

        </button>

      </div>


      {/* INFORMATION */}

      <div className="resources-info-card">

        <div className="resources-info-icon">
          💡
        </div>

        <div>
          <strong>
            Official exam-board resources
          </strong>

          <p>
            Resources will be linked to official WJEC
            assessment materials wherever possible.
          </p>
        </div>

      </div>

    </div>
  );
}

export default Resources;