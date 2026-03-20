import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
// Re-export the subject package App unchanged (direct import from packages/subject)
import SubjectApp from '../subject/App';

export default function StreamAdapter(props: any) {
	const hostRef = useRef<HTMLDivElement | null>(null);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		const host = document.createElement('div');
		host.setAttribute('data-stream-portal', 'true');
		document.body.appendChild(host);
		hostRef.current = host;
		setMounted(true);
		return () => {
			if (hostRef.current && hostRef.current.parentNode) hostRef.current.parentNode.removeChild(hostRef.current);
		};
	}, []);

	if (mounted && hostRef.current) {
		return createPortal(<SubjectApp {...props} />, hostRef.current);
	}

	// Render nothing until portal is ready (keeps original UI files unchanged)
	return null;
}
