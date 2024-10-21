import {
  Box,
  Card,
  Layout,
  Link,
  List,
  Page,
  Text,
  BlockStack,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

// Sample data for blog posts
const blogPosts = [
  {
    id: 1,
    title: "Understanding Shopify App Development",
    url: "https://shopify.dev/docs/apps",
    excerpt: "A comprehensive guide to building apps on Shopify.",
  },
  {
    id: 2,
    title: "Best Practices for Shopify App Design",
    url: "https://shopify.dev/docs/apps/design-guidelines",
    excerpt: "Design guidelines for a better user experience.",
  },
  {
    id: 3,
    title: "Getting Started with Polaris",
    url: "https://polaris.shopify.com/",
    excerpt: "Learn how to use Polaris in your Shopify app.",
  },
];

export default function BlogPage() {
  return (
    <Page>
      <TitleBar title="Blog Posts" />
      <Layout>
        <Layout.Section>
          <Card title="Blog Posts" sectioned>
            <BlockStack gap="300">
              <List>
                {blogPosts.map((post) => (
                  <List.Item key={post.id}>
                    <Link url={post.url} target="_blank" removeUnderline>
                      <Text as="h3" variant="headingMd">
                        {post.title}
                      </Text>
                      <Text as="p" variant="bodyMd">
                        {post.excerpt}
                      </Text>
                    </Link>
                  </List.Item>
                ))}
              </List>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
