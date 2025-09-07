export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target?: string; // Component ID to highlight
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  image?: string; // Optional image to show
}
