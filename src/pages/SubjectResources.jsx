const subjectResources = {
  Mathematics: {
    icon: "📐",
    description: "WJEC AS/A Level Mathematics",
    wjecUrl:
      "https://www.wjec.co.uk/qualifications/mathematics-aas-level/",
    specificationUrl:
      "https://www.wjec.co.uk/qualifications/mathematics-aas-level/",
    pastPapersUrl:
      "https://www.wjec.co.uk/qualifications/mathematics-aas-level/#tab_pastpapers",
    topics: [
      "Indices",
      "Surds",
      "Algebra",
      "Quadratic equations",
      "Coordinate geometry",
      "Trigonometry",
      "Differentiation",
      "Integration",
      "Sequences and series",
      "Statistics",
      "Probability",
      "Mechanics",
    ],
  },

  "Further Mathematics": {
    icon: "∑",
    description: "WJEC AS/A Level Further Mathematics",
    wjecUrl:
      "https://www.wjec.co.uk/qualifications/mathematics-aas-level/",
    specificationUrl:
      "https://www.wjec.co.uk/qualifications/mathematics-aas-level/",
    pastPapersUrl:
      "https://www.wjec.co.uk/qualifications/mathematics-aas-level/#tab_pastpapers",
    topics: [
      "Further algebra",
      "Complex numbers",
      "Matrices",
      "Further calculus",
      "Differential equations",
      "Further vectors",
      "Further trigonometry",
      "Further statistics",
      "Further mechanics",
    ],
  },
};

function SubjectResources({ subject, setPage }) {
  const resource =
    subjectResources[subject?.name] ||
    {
      icon: subject?.icon || "📚",
      description:
        subject?.description ||
        "WJEC sixth-form resources",
      wjecUrl: "",
      specificationUrl: "",
      pastPapersUrl: "",
      topics: [],
    };

  function openLink(url) {
    if (!url) return;

    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <div className="revision-page">

      <button
        type="button"
        className="back-button"
        onClick={() => setPage("revision")}
      >
        ← Back to revision
      </button>

      <div className="revision-header">

        <div>

          <p className="card-eyebrow">
            WJEC SUBJECT
          </p>

          <h2>
            {resource.icon} {subject?.name}
          </h2>

          <p className="revision-description">
            {resource.description}
          </p>

        </div>

      </div>


      {/* RESOURCES */}

      <div className="revision-section-heading">

        <h3>
          Resources
        </h3>

        <p>
          Official WJEC resources for this subject.
        </p>

      </div>


      <div className="revision-subject-grid">

        <button
          type="button"
          className="revision-subject-card"
          onClick={() =>
            openLink(resource.specificationUrl)
          }
        >

          <div className="revision-subject-top">

            <div className="revision-subject-icon">
              📋
            </div>

            <div className="revision-subject-arrow">
              →
            </div>

          </div>

          <div className="revision-subject-content">

            <h3>
              Specification
            </h3>

            <p>
              View the official WJEC specification
              and qualification information.
            </p>

          </div>

          <div className="open-subject">
            <span>
              Open specification
            </span>

            <span>
              →
            </span>
          </div>

        </button>


        <button
          type="button"
          className="revision-subject-card"
          onClick={() =>
            openLink(resource.pastPapersUrl)
          }
        >

          <div className="revision-subject-top">

            <div className="revision-subject-icon">
              📄
            </div>

            <div className="revision-subject-arrow">
              →
            </div>

          </div>

          <div className="revision-subject-content">

            <h3>
              Past Papers
            </h3>

            <p>
              Find official WJEC past papers and
              mark schemes.
            </p>

          </div>

          <div className="open-subject">
            <span>
              View past papers
            </span>

            <span>
              →
            </span>
          </div>

        </button>


        <button
          type="button"
          className="revision-subject-card"
          onClick={() =>
            openLink(resource.wjecUrl)
          }
        >

          <div className="revision-subject-top">

            <div className="revision-subject-icon">
              🔗
            </div>

            <div className="revision-subject-arrow">
              →
            </div>

          </div>

          <div className="revision-subject-content">

            <h3>
              WJEC Resources
            </h3>

            <p>
              Access the official WJEC resources
              for this qualification.
            </p>

          </div>

          <div className="open-subject">
            <span>
              Open WJEC
            </span>

            <span>
              →
            </span>
          </div>

        </button>

      </div>


      {/* TOPICS */}

      <div
        className="revision-section-heading"
        style={{ marginTop: "35px" }}
      >

        <h3>
          Topics
        </h3>

        <p>
          Topics that will be added to your
          revision area.
        </p>

      </div>


      {resource.topics.length > 0 ? (

        <div className="subject-resource-preview">

          {resource.topics.map((topic) => (
            <span key={topic}>
              📚 {topic}
            </span>
          ))}

        </div>

      ) : (

        <div className="no-subjects">

          <div className="no-subjects-icon">
            📚
          </div>

          <h3>
            Topics coming soon
          </h3>

          <p>
            We will add the full topic structure
            from the WJEC specification here.
          </p>

        </div>

      )}


      {/* INFORMATION */}

      <div
        className="revision-information"
        style={{ marginTop: "30px" }}
      >

        <div className="revision-information-icon">
          💡
        </div>

        <div>

          <strong>
            Official WJEC resources
          </strong>

          <p>
            The links above take you directly to
            the official WJEC resources rather than
            storing duplicate copies in the app.
          </p>

        </div>

      </div>

    </div>
  );
}

export default SubjectResources;