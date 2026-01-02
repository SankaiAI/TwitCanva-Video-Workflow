/**
 * LazyImage.tsx
 * 
 * A lazy-loading image component that shows a skeleton placeholder
 * and only loads the actual image when it enters the viewport.
 * Uses Intersection Observer for efficient lazy loading.
 */

import React, { useState, useRef, useEffect } from 'react';

interface LazyImageProps {
    src: string;
    alt: string;
    className?: string;
    placeholderClassName?: string;
    /** Threshold for intersection observer (0-1) */
    threshold?: number;
    /** Root margin for preloading before visible */
    rootMargin?: string;
}

export const LazyImage: React.FC<LazyImageProps> = ({
    src,
    alt,
    className = '',
    placeholderClassName = '',
    threshold = 0.1,
    rootMargin = '50px'
}) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isInView, setIsInView] = useState(false);
    const [hasError, setHasError] = useState(false);
    const imgRef = useRef<HTMLDivElement>(null);

    // Set up Intersection Observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setIsInView(true);
                        // Once in view, disconnect observer
                        observer.disconnect();
                    }
                });
            },
            {
                threshold,
                rootMargin
            }
        );

        if (imgRef.current) {
            observer.observe(imgRef.current);
        }

        return () => observer.disconnect();
    }, [threshold, rootMargin]);

    const handleLoad = () => {
        setIsLoaded(true);
    };

    const handleError = () => {
        setHasError(true);
        setIsLoaded(true);
    };

    return (
        <div ref={imgRef} className={`relative ${className}`}>
            {/* Skeleton placeholder - shown until image loads */}
            {!isLoaded && (
                <div
                    className={`absolute inset-0 bg-neutral-800 animate-pulse ${placeholderClassName}`}
                />
            )}

            {/* Error state */}
            {hasError && (
                <div className="absolute inset-0 bg-neutral-800 flex items-center justify-center">
                    <span className="text-neutral-500 text-xs">Failed to load</span>
                </div>
            )}

            {/* Actual image - only rendered when in view */}
            {isInView && !hasError && (
                <img
                    src={src}
                    alt={alt}
                    onLoad={handleLoad}
                    onError={handleError}
                    className={`w-full h-full object-cover transition-opacity duration-150 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                    style={{ willChange: 'opacity' }}
                />
            )}
        </div>
    );
};
