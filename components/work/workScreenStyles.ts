/**
 * Styles for the Work screen (app/(tabs)/work.tsx).
 *
 * This file used to hold 574 keys, of which SEVEN were referenced - the other
 * 567 (122 of them raw, unscaled `fontSize` literals, a third of the app-wide
 * count) were left behind by earlier rewrites and never deleted. Program 4
 * removed them; the section headings moved to the shared `SectionTitle`, so
 * what remains is the screen's frame. Screen-specific styles live in the
 * `local` sheet beside the component.
 */
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
    background: {
        flex: 1,
        backgroundColor: '#020617',
    },
    container: {
        flex: 1,
    },
});
