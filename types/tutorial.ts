export interface TutorialStep {
    id: string;
    title: string;

    // Simple Tutorial properties
    description?: string;
    position?: 'top' | 'bottom' | 'center' | 'left' | 'right';

    // Enhanced (Interactive) Tutorial properties
    message?: string;
    highlightArea?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    arrowPosition?: 'top' | 'bottom' | 'left' | 'right';
    tooltipPosition?: 'top' | 'bottom' | 'center';
}

export type EnhancedTutorialStep = TutorialStep;
