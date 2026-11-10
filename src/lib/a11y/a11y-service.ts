// Accessibility (a11y) Verification & Contract Utilities for WhatsPulse CRM
// Enforces WAI-ARIA modal dialog semantics, accessible button labeling, and WCAG AA contrast compliance.

export interface DialogA11yProps {
  role?: string;
  ariaModal?: boolean;
  ariaLabel?: string;
}

export interface ButtonA11yProps {
  hasVisibleText: boolean;
  ariaLabel?: string;
}

export class A11yService {
  /**
   * Validates modal dialog attributes per WAI-ARIA 1.2 specifications
   */
  public static validateDialogAttributes(props: DialogA11yProps): {
    isValid: boolean;
    error?: string;
  } {
    if (props.role !== 'dialog' && props.role !== 'alertdialog') {
      return {
        isValid: false,
        error: 'Modal dialog must have role="dialog" or role="alertdialog"',
      };
    }

    if (props.ariaModal !== true) {
      return {
        isValid: false,
        error: 'Modal dialog must have aria-modal="true"',
      };
    }

    if (!props.ariaLabel || props.ariaLabel.trim() === '') {
      return {
        isValid: false,
        error: 'Modal dialog must have an accessible title via aria-label or aria-labelledby',
      };
    }

    return { isValid: true };
  }

  /**
   * Verifies that icon-only buttons provide an accessible name for screen readers
   */
  public static validateButtonAccessibility(props: ButtonA11yProps): {
    isValid: boolean;
    error?: string;
  } {
    if (!props.hasVisibleText && (!props.ariaLabel || props.ariaLabel.trim() === '')) {
      return {
        isValid: false,
        error: 'Icon-only button must have a non-empty aria-label or title attribute',
      };
    }

    return { isValid: true };
  }

  /**
   * Parses hex color string into sRGB components (0 to 1)
   */
  private static parseHex(hex: string): [number, number, number] {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
    const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
    return [r, g, b];
  }

  /**
   * Computes relative luminance according to WCAG 2.1 formula
   */
  public static getLuminance(hex: string): number {
    const [r, g, b] = this.parseHex(hex);

    const transform = (val: number) => {
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    };

    const sR = transform(r);
    const sG = transform(g);
    const sB = transform(b);

    return 0.2126 * sR + 0.7152 * sG + 0.0722 * sB;
  }

  /**
   * Calculates WCAG contrast ratio between two hex colors (1 to 21)
   */
  public static calculateContrastRatio(color1Hex: string, color2Hex: string): number {
    const lum1 = this.getLuminance(color1Hex);
    const lum2 = this.getLuminance(color2Hex);

    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);

    return (brightest + 0.05) / (darkest + 0.05);
  }
}
