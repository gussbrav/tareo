import { StyleSheet, Text, View } from 'react-native'

import { colors, spacing, type } from '../theme'

export default function SectionTitle({ children, hint }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{children}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm },
  title: { ...type.overline, color: colors.text.tertiary },
  hint: { ...type.caption, color: colors.text.muted, marginTop: 2 },
})
