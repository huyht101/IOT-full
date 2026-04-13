import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { useEffect } from 'react';
import styles from './ApiDocsPage.module.css';

function ApiDocsPage() {
  useEffect(() => {
    document.title = 'IoT Dashboard | API Docs';
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>OpenAPI / Swagger</p>
          <h1 className={styles.title}>IoT Dashboard API Docs</h1>
          <p className={styles.subtitle}>
            Interactive documentation rendered from the current OpenAPI specification.
          </p>
        </div>
      </header>

      <section className={styles.docsShell}>
        <SwaggerUI url="/openapi.yaml" docExpansion="list" defaultModelsExpandDepth={-1} />
      </section>
    </div>
  );
}

export default ApiDocsPage;
