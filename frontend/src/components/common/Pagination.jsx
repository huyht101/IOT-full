import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './Pagination.module.css';

function buildPageItems(currentPage, totalPages) {
  if (totalPages <= 0) {
    return [];
  }

  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);

  return Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((left, right) => left - right);
}

function Pagination({ page, totalPages, onPageChange, disabled }) {
  const pageItems = buildPageItems(page, totalPages);

  return (
    <div className={styles.pagination}>
      <button
        type="button"
        className={styles.control}
        disabled={disabled || page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft size={16} />
        Previous
      </button>
      <div className={styles.pages}>
        {pageItems.map((pageItem) => (
          <button
            key={pageItem}
            type="button"
            className={`${styles.pageButton} ${pageItem === page ? styles.active : ''}`}
            disabled={disabled}
            onClick={() => onPageChange(pageItem)}
          >
            {pageItem}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={styles.control}
        disabled={disabled || totalPages === 0 || page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

export default Pagination;
