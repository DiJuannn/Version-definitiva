import { Document, Page, Text, View } from "@react-pdf/renderer";
import { pdfStyles, colors } from "@/lib/pdf/styles";
import { PdfHeader, PdfFooter, Watermark, rowStyle } from "@/lib/pdf/components";

function currency(value: number) {
  return value.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

type BudgetCategoryWithItems = {
  id: string;
  name: string;
  items: {
    id: string;
    description: string;
    quantity: unknown;
    unitPrice: unknown;
    taxRate: unknown;
  }[];
};

export function BudgetDocument({
  projectName,
  categories,
  watermark,
}: {
  projectName: string;
  categories: BudgetCategoryWithItems[];
  // Solo en el plan Free — Pro descarga el PDF limpio.
  watermark?: boolean;
}) {
  const categoriesWithTotals = categories.map((category) => {
    const rows = category.items.map((item) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      const taxRate = Number(item.taxRate);
      const subtotal = quantity * unitPrice;
      const total = subtotal * (1 + taxRate / 100);
      return { ...item, quantity, unitPrice, taxRate, total };
    });
    const categoryTotal = rows.reduce((sum, item) => sum + item.total, 0);
    return { ...category, rows, categoryTotal };
  });

  const grandTotal = categoriesWithTotals.reduce(
    (sum, category) => sum + category.categoryTotal,
    0,
  );

  return (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        {watermark && <Watermark />}
        <PdfHeader eyebrow="Presupuesto" title={projectName} />

        {categoriesWithTotals.map((category) => {
          const { rows, categoryTotal } = category;

          return (
            <View key={category.id} style={pdfStyles.section} wrap={false}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-end",
                  marginBottom: 6,
                }}
              >
                <Text style={pdfStyles.sectionTitle}>{category.name}</Text>
                <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: colors.accent }}>
                  {currency(categoryTotal)}
                </Text>
              </View>
              <View style={pdfStyles.tableHeader}>
                <Text style={[pdfStyles.th, { flex: 1 }]}>Concepto</Text>
                <Text style={[pdfStyles.th, { width: 50 }]}>Cant.</Text>
                <Text style={[pdfStyles.th, { width: 70 }]}>Precio</Text>
                <Text style={[pdfStyles.th, { width: 40 }]}>IVA</Text>
                <Text style={[pdfStyles.th, { width: 70 }]}>Total</Text>
              </View>
              {rows.map((item, i) => (
                <View key={item.id} style={rowStyle(i)}>
                  <Text style={[pdfStyles.td, { flex: 1 }]}>{item.description}</Text>
                  <Text style={[pdfStyles.td, { width: 50 }]}>{item.quantity}</Text>
                  <Text style={[pdfStyles.td, { width: 70 }]}>
                    {currency(item.unitPrice)}
                  </Text>
                  <Text style={[pdfStyles.td, { width: 40 }]}>{item.taxRate}%</Text>
                  <Text style={[pdfStyles.td, { width: 70 }]}>
                    {currency(item.total)}
                  </Text>
                </View>
              ))}
            </View>
          );
        })}

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: colors.ink,
            paddingVertical: 10,
            paddingHorizontal: 10,
            marginTop: 8,
          }}
        >
          <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: colors.bg, textTransform: "uppercase", letterSpacing: 1 }}>
            Total
          </Text>
          <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: colors.accent }}>
            {currency(grandTotal)}
          </Text>
        </View>

        <PdfFooter projectName={projectName} />
      </Page>
    </Document>
  );
}
