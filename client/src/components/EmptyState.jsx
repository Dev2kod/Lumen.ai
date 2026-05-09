import { Link } from 'react-router-dom';
import { LibraryStack } from './Illustration.jsx';

export default function EmptyState() {
  return (
    <div className="py-20 max-w-[520px]">
      <div className="flex justify-start mb-7">
        <LibraryStack size={220} />
      </div>
      <h2 className="font-display italic font-normal text-[38px] mb-4">Nothing yet.</h2>
      <p className="text-muted text-base leading-relaxed mb-8">
        Lumen turns the things you read and watch into things you understand and
        share. Drop in a YouTube URL, an article link, or some pasted notes —
        get back a summary, flashcards, a quiz, and a couple of ready-to-post
        drafts.
      </p>
      <Link
        to="/new"
        className="inline-flex items-center gap-2 px-4 py-[9px] text-sm font-medium rounded-sm bg-accent text-accent-on border border-accent hover:bg-accent-hover hover:border-accent-hover no-underline"
      >
        Add your first source
      </Link>
    </div>
  );
}
